window.__ModuleLoader__.load({
	id: "dsh-s-m-c-center",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared/protocol/api-paths.ts
		/** API paths shared by the host routes and the browser api client. */
		const SMC_API = {
			skills: "/api/dsh-s-m-c-center/skills",
			skillRead: "/api/dsh-s-m-c-center/skills/read",
			skillDelete: "/api/dsh-s-m-c-center/skills/delete",
			skillScan: "/api/dsh-s-m-c-center/skills/scan",
			/** Register external skills: the canonical copy stays where it is. */
			skillRegister: "/api/dsh-s-m-c-center/skills/register",
			/** Drop a registry entry (and its link, when one exists). */
			skillUnregister: "/api/dsh-s-m-c-center/skills/unregister",
			/** Traceability pass: check every registry entry's path still exists. */
			skillRefresh: "/api/dsh-s-m-c-center/skills/refresh",
			/** Move a native skill into the store (canonical copy + back-link). */
			skillMigrate: "/api/dsh-s-m-c-center/skills/migrate",
			/** Undo a migration: remove the link, restore the origin, drop the entry. */
			skillUnmigrate: "/api/dsh-s-m-c-center/skills/unmigrate",
			/** Create (or confirm) the `~/.dsh/skills/<slug>` link for one skill. */
			skillLink: "/api/dsh-s-m-c-center/skills/link",
			/** Remove the link for one skill (the canonical copy is never touched). */
			skillUnlink: "/api/dsh-s-m-c-center/skills/unlink",
			/** Verify one link (resolves? target alive? tracked?). */
			skillVerify: "/api/dsh-s-m-c-center/skills/verify",
			/** Delete an untracked link (one the ledger has no record of). */
			skillDeleteLink: "/api/dsh-s-m-c-center/skills/delete-link",
			/** Per-conversation selection index for one workspace. */
			contexts: "/api/dsh-s-m-c-center/contexts",
			/** One conversation's selection (get / toggle). */
			contextsGet: "/api/dsh-s-m-c-center/contexts/get",
			contextsToggle: "/api/dsh-s-m-c-center/contexts/toggle",
			contextsReset: "/api/dsh-s-m-c-center/contexts/reset",
			skillStore: "/api/dsh-s-m-c-center/skills/store",
			skillRollback: "/api/dsh-s-m-c-center/skills/rollback",
			/** Re-run the one-shot migration after a rollback (the uninstall page's undo). */
			skillRemigrate: "/api/dsh-s-m-c-center/skills/remigrate",
			mcp: "/api/dsh-s-m-c-center/mcp",
			mcpSave: "/api/dsh-s-m-c-center/mcp/save",
			/** Activate (true) or archive (false) a definition — see McpServerSummary.archived. */
			mcpEnabled: "/api/dsh-s-m-c-center/mcp/enabled",
			/** Move every archived definition back into the active document (uninstall page). */
			mcpRestoreAll: "/api/dsh-s-m-c-center/mcp/restore-all",
			mcpDelete: "/api/dsh-s-m-c-center/mcp/delete",
			mcpTest: "/api/dsh-s-m-c-center/mcp/test",
			cli: "/api/dsh-s-m-c-center/cli",
			cliState: "/api/dsh-s-m-c-center/cli/state",
			cliSubcommands: "/api/dsh-s-m-c-center/cli/subcommands",
			cliSave: "/api/dsh-s-m-c-center/cli/save",
			cliEnabled: "/api/dsh-s-m-c-center/cli/enabled",
			cliDelete: "/api/dsh-s-m-c-center/cli/delete",
			cliProbe: "/api/dsh-s-m-c-center/cli/probe",
			settings: "/api/dsh-s-m-c-center/settings",
			settingsSave: "/api/dsh-s-m-c-center/settings/save"
		};
		//#endregion
		//#region src/client/shell/sidebar.ts
		/**
		* Sidebar entry + floating panel for the conversation-skill selection.
		*
		* The settings card cannot host this block well (it has no notion of "the
		* conversation you are looking at"), so the entry lives in the web shell's
		* sidebar right under the New Session button, and the panel is a small
		* fixed-position window. Rendering is imperative DOM on purpose: the panel
		* outlives the settings card's React tree and must survive shell re-renders
		* with the same self-healing pattern the family uses.
		*
		* The panel is a *window*, not a docked popover: it is dragged by its header
		* and resized from its corner, and both stick (localStorage). A position is
		* only chosen for it the first time — after that the user's word is final.
		*
		* The panel always shows *the conversation you are in*: the session id comes
		* from the dsh client's persisted selection (`localStorage['dsh.sessions.current']`,
		* written by the session controller on every switch) and the title from
		* `document.title` (the layout layer projects the current session title there,
		* suffixed with ` — <product>`). 刷新 re-reads both and re-fetches the list, so
		* a renamed conversation shows its new name without leaving the page — a full
		* reload was the earlier answer to that, and it cost the window's position and
		* anything typed in the composer. The open state lives in sessionStorage so the
		* panel comes back after a reload the user asked for themselves — but not in a
		* new tab, where nothing did.
		*
		* Toggling writes the same per-conversation JSON the settings page and the
		* `skill_select` tool write, so all three always agree.
		* @module
		*/
		const ENTRY_ID = "data-dsh-s-m-c-entry";
		const PANEL_ID = "smc-fp";
		const STYLE_ID = "dsh-s-m-c-sidebar-style";
		const PANEL_Z = 9999;
		/** localStorage key the dsh session controller persists its selection under. */
		const SESSION_STORAGE_KEY = "dsh.sessions.current";
		/** Separator dsh's DocumentTitle layer puts between session and product title. */
		const TITLE_SEPARATOR = " — ";
		/** Remembered window geometry (localStorage: a real preference, kept for good). */
		const PANEL_BOX_KEY = "dsh-s-m-c-center.panel.box";
		/** Whether the window is open (sessionStorage: survives our reload, not a new tab). */
		const PANEL_OPEN_KEY = "dsh-s-m-c-center.panel.open";
		/** Smallest size the window may be dragged down to. */
		const MIN_W = 260;
		const MIN_H = 150;
		/** One fetch round trip with the same error shape as the settings client. */
		async function api$1(method, path, payload) {
			const response = await fetch(path, payload === void 0 ? { method } : {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			let body;
			try {
				body = await response.json();
			} catch {
				throw new Error(`HTTP ${response.status}`);
			}
			if (!response.ok || body.ok === false) throw new Error(String(body.error ?? `HTTP ${response.status}`));
			return body;
		}
		/** Remembered geometry, or null when the window has never been moved. */
		function readBox() {
			try {
				const raw = localStorage.getItem(PANEL_BOX_KEY);
				if (raw === null) return null;
				const box = JSON.parse(raw);
				const num = (v) => typeof v === "number" && isFinite(v) ? v : null;
				const left = num(box.left);
				const top = num(box.top);
				const width = num(box.width);
				const height = num(box.height);
				if (left === null || top === null || width === null || height === null) return null;
				return {
					left,
					top,
					width,
					height
				};
			} catch {
				return null;
			}
		}
		/** Persist the window's geometry (best effort — storage can be unavailable). */
		function writeBox(box) {
			try {
				localStorage.setItem(PANEL_BOX_KEY, JSON.stringify(box));
			} catch {}
		}
		/** Whether the window should come back on its own after our reload. */
		function readOpenFlag() {
			try {
				return sessionStorage.getItem(PANEL_OPEN_KEY) === "1";
			} catch {
				return false;
			}
		}
		/** Record the window's open state for the next reload, or forget it. */
		function writeOpenFlag(open) {
			try {
				if (open) sessionStorage.setItem(PANEL_OPEN_KEY, "1");
				else sessionStorage.removeItem(PANEL_OPEN_KEY);
			} catch {}
		}
		/** Inject the one-time stylesheet (theme variables + light fallbacks). */
		function ensureStyle() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = `
/* Collapsed rail: dsh publishes data-sidebar-collapsed on the AppFrame root
   (only while collapsed), and the rail lays controls out as 36x36 boxes with
   12px rounding — match that so the icon-only entry reads like the others. */
[data-sidebar-collapsed] [${ENTRY_ID}]{justify-content:center!important;width:36px!important;height:36px!important;min-height:36px!important;margin:0!important;padding:0!important;border-radius:12px!important}
[data-sidebar-collapsed] [${ENTRY_ID}]:hover{background:var(--dsw-alias-interactive-bg-hover,#f0f1f3)!important}
[data-sidebar-collapsed] [${ENTRY_ID}]>span:not(:first-child){display:none!important}
.smc-fp{position:fixed;left:280px;top:80px;width:min(420px,92vw);height:min(560px,72vh);min-width:${MIN_W}px;min-height:${MIN_H}px;z-index:${PANEL_Z};
  display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1f2328);
  border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:12px;box-shadow:0 12px 40px rgba(8,10,16,.18);
  font-size:13px;overflow:hidden;resize:both}
.smc-fp-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1);
  cursor:grab;user-select:none;touch-action:none}
.smc-fp-head.smc-dragging{cursor:grabbing}
.smc-fp-head b{flex:1;font-size:13px}
.smc-fp-sub{padding:8px 12px 0;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px}
.smc-fp-sub .t{color:inherit;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.smc-fp-body{overflow:auto;padding:8px 12px 12px;flex:1}
.smc-fp-row{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--dsw-alias-border-l2,#f1f2f4)}
.smc-fp-row .t{flex:1;min-width:0}
.smc-fp-row .t .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-row .t .d{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-note{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;padding:4px 2px}
.smc-fp-err{color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;padding:4px 2px}
`;
			document.head.appendChild(style);
		}
		/** Build the sidebar entry button (icon + label), family-placed. */
		function buildEntry(onClick) {
			const button = document.createElement("button");
			button.type = "button";
			button.setAttribute(ENTRY_ID, "");
			button.setAttribute("aria-label", "会话技能");
			button.title = "会话技能";
			button.style.cssText = [
				"display:flex",
				"align-items:center",
				"gap:8px",
				"width:100%",
				"padding:8px 10px",
				"border:none",
				"background:transparent",
				"color:inherit",
				"cursor:pointer",
				"text-align:left",
				"font:inherit",
				"border-radius:8px"
			].join(";");
			const icon = document.createElement("span");
			icon.innerHTML = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\"><path d=\"M3 2h7l3 3v9H3z\" stroke=\"currentColor\" stroke-width=\"1.4\" fill=\"none\"/><path d=\"M6 8h4M6 11h4\" stroke=\"currentColor\" stroke-width=\"1.4\"/></svg>";
			const label = document.createElement("span");
			label.textContent = "会话技能";
			button.append(icon, label);
			button.addEventListener("click", onClick);
			return button;
		}
		/**
		* Place the entry as the first item under the New Session button.
		*
		* The button is found by its CSS-module class (hashed names keep the original
		* word) with the localized aria-label as the backup — the brand button shares
		* the aria-label, so class matching wins. Falls back to the plugin-family
		* block while the shell renders a layout without the button.
		*/
		function placeEntry(entry) {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return false;
			const buttons = Array.from(column.querySelectorAll("button"));
			const newSession = buttons.find((b) => /newSession/i.test(b.className)) ?? buttons.find((b) => {
				const label = b.getAttribute("aria-label") ?? "";
				return (label === "新建会话" || label === "New session") && !/brand/i.test(b.className);
			});
			if (newSession !== void 0) {
				if (entry.parentElement === newSession.parentElement && entry.previousElementSibling === newSession) return true;
				newSession.after(entry);
				return true;
			}
			const logoRow = column.querySelector("[class*=\"logoRow\"]");
			const root = logoRow?.parentElement ?? column.firstElementChild;
			if (root === null) return false;
			if (entry.parentElement === root && root.contains(entry)) return true;
			const family = root.querySelectorAll("[data-dsh-taskboard-entry],[data-dsh-ssh-entry],[data-dsh-skill-explorer-entry]");
			const last = family.length > 0 ? family[family.length - 1] : logoRow ?? root.firstElementChild;
			if (last?.parentElement === root) last.after(entry);
			else root.insertBefore(entry, root.firstChild);
			return true;
		}
		/** The conversation the user is looking at, read from the dsh client's own state. */
		function currentConversation() {
			let id;
			try {
				const raw = localStorage.getItem(SESSION_STORAGE_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed?.sessionId === "string" && parsed.sessionId !== "") id = parsed.sessionId;
				}
			} catch {}
			const full = document.title;
			const at = full.lastIndexOf(TITLE_SEPARATOR);
			const title = at > 0 ? full.slice(0, at) : "";
			return {
				id,
				title
			};
		}
		/**
		* One toggle round trip against the live routes.
		*
		* No cwd: every selection lives in one relay table on the host, keyed by
		* session id, so this panel and the settings page read the same document.
		*/
		async function toggleSkill(sessionId, slug) {
			return (await api$1("POST", SMC_API.contextsToggle, {
				sessionId,
				slug
			})).selection;
		}
		/** Drop this conversation's own selection so it follows the default again. */
		async function resetSelection(sessionId) {
			return (await api$1("POST", SMC_API.contextsReset, { sessionId })).selection.selected;
		}
		/**
		* Open the floating panel.
		*
		* Which conversation this panel is about (its id and title) is read from the
		* page at open time — the session id from the client's persisted selection and
		* the title from `document.title`. 刷新 re-reads both and re-fetches the list,
		* so renaming a conversation shows up without a page reload. (An earlier
		* version reloaded the whole page instead, which did fix the stale title but
		* threw away the window's position and everything typed in the composer.)
		*/
		function openPanel(entry) {
			ensureStyle();
			document.getElementById(PANEL_ID)?.remove();
			let sessionId;
			const saved = readBox();
			const panel = document.createElement("div");
			panel.id = PANEL_ID;
			panel.className = "smc-fp";
			if (saved !== null) {
				panel.style.width = `${saved.width}px`;
				panel.style.height = `${saved.height}px`;
			}
			const head = document.createElement("div");
			head.className = "smc-fp-head";
			const title = document.createElement("b");
			title.textContent = "会话技能";
			const refresh = document.createElement("button");
			refresh.type = "button";
			refresh.textContent = "↻ 刷新";
			refresh.title = "重新读取当前会话与技能列表（不刷新整个页面）";
			refresh.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;font-size:12px;opacity:.75";
			const close = document.createElement("button");
			close.type = "button";
			close.textContent = "✕";
			close.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;font-size:14px";
			/** Set once the geometry watcher exists; closing must not leave it running. */
			let stopWatching = () => {};
			close.addEventListener("click", () => {
				writeOpenFlag(false);
				stopWatching();
				panel.remove();
			});
			head.append(title, refresh, close);
			const sub = document.createElement("div");
			sub.className = "smc-fp-sub";
			const subTitle = document.createElement("div");
			subTitle.className = "t";
			const subId = document.createElement("div");
			sub.append(subTitle, subId);
			/**
			* Re-read which conversation we are in and redraw the caption. Everything
			* that re-fetches (刷新, and a re-open) calls this first, because the id and
			* the title both live on the page and can change under us — a rename only
			* touches `document.title`.
			*/
			const syncConversation = () => {
				const current = currentConversation();
				sessionId = current.id;
				subTitle.textContent = sessionId === void 0 ? "新会话（尚未开始对话）" : current.title || "当前会话";
				subId.textContent = sessionId === void 0 ? "开始对话后即可在此选择技能" : sessionId.slice(0, 8) + "…";
			};
			syncConversation();
			const bodyEl = document.createElement("div");
			bodyEl.className = "smc-fp-body";
			bodyEl.textContent = "加载中…";
			panel.append(head, sub, bodyEl);
			document.body.appendChild(panel);
			writeOpenFlag(true);
			/** Where the window currently sits, in viewport coordinates. */
			const boxOf = () => {
				const r = panel.getBoundingClientRect();
				return {
					left: r.left,
					top: r.top,
					width: r.width,
					height: r.height
				};
			};
			let pending = 0;
			let settled = null;
			const persist = () => {
				writeBox(boxOf());
			};
			const schedulePersist = () => {
				if (pending !== 0) return;
				pending = window.setTimeout(() => {
					pending = 0;
					persist();
				}, 150);
			};
			const resizeObserver = new ResizeObserver(() => {
				const r = panel.getBoundingClientRect();
				if (settled === null) {
					settled = {
						width: r.width,
						height: r.height
					};
					return;
				}
				if (Math.abs(r.width - settled.width) < 1 && Math.abs(r.height - settled.height) < 1) return;
				settled = {
					width: r.width,
					height: r.height
				};
				schedulePersist();
			});
			head.addEventListener("mousedown", (event) => {
				if (event.target.closest("button") !== null) return;
				event.preventDefault();
				const start = boxOf();
				const fromX = event.clientX;
				const fromY = event.clientY;
				head.classList.add("smc-dragging");
				const move = (e) => {
					const left = Math.min(Math.max(start.left + e.clientX - fromX, -start.width + 120), window.innerWidth - 40);
					const top = Math.min(Math.max(start.top + e.clientY - fromY, 0), window.innerHeight - 24);
					panel.style.left = `${Math.round(left)}px`;
					panel.style.top = `${Math.round(top)}px`;
				};
				const up = () => {
					window.removeEventListener("mousemove", move);
					window.removeEventListener("mouseup", up);
					head.classList.remove("smc-dragging");
					persist();
				};
				window.addEventListener("mousemove", move);
				window.addEventListener("mouseup", up);
			});
			const entryRect = entry.getBoundingClientRect();
			panel.style.visibility = "hidden";
			requestAnimationFrame(() => {
				const panelRect = panel.getBoundingClientRect();
				let left;
				let top;
				if (saved !== null) {
					left = Math.min(Math.max(saved.left, -panelRect.width + 120), Math.max(0, window.innerWidth - 40));
					top = Math.min(Math.max(saved.top, 0), Math.max(0, window.innerHeight - 24));
				} else {
					left = entryRect.right + 12;
					if (left + panelRect.width > window.innerWidth - 8) left = Math.max(8, entryRect.left - panelRect.width - 12);
					top = Math.min(Math.max(entryRect.top - 4, 8), Math.max(8, window.innerHeight - panelRect.height - 8));
				}
				panel.style.left = `${Math.round(left)}px`;
				panel.style.top = `${Math.round(top)}px`;
				panel.style.visibility = "";
				resizeObserver.observe(panel);
				stopWatching = () => {
					resizeObserver.disconnect();
				};
			});
			const note = (text, isError = false) => {
				const el = document.createElement("div");
				el.className = isError ? "smc-fp-err" : "smc-fp-note";
				el.textContent = text;
				bodyEl.appendChild(el);
			};
			const render = (skillRows, selection, table) => {
				bodyEl.textContent = "";
				const id = sessionId;
				if (id === void 0) {
					note("新会话还没有会话 ID——发第一条消息后，这里就会跟随该对话的技能选择");
					return;
				}
				note(selection.configured === true ? "本会话已单独配置" : "本会话跟随「会话默认」");
				note("配置表：" + (table === "" ? "（未解析）" : table));
				if (selection.configured === true) {
					const reset = document.createElement("button");
					reset.type = "button";
					reset.textContent = "跟随默认（清除本会话）";
					reset.title = "删除本会话自己的选择，改为跟随「会话默认」";
					reset.style.cssText = "border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:2px 8px;border-radius:6px;opacity:.8";
					reset.addEventListener("click", () => {
						reset.disabled = true;
						resetSelection(id).then(() => {
							load();
						}).catch((e) => {
							note(String(e?.message ?? e), true);
							reset.disabled = false;
						});
					});
					bodyEl.appendChild(reset);
				}
				const picked = new Set(selection.selected);
				if (skillRows.length === 0) {
					note("没有可勾选的技能（先在管理页登记或迁移入库）");
					return;
				}
				for (const row of skillRows) {
					const line = document.createElement("div");
					line.className = "smc-fp-row";
					const box = document.createElement("input");
					box.type = "checkbox";
					box.checked = picked.has(row.slug ?? "");
					const text = document.createElement("div");
					text.className = "t";
					const nameEl = document.createElement("div");
					nameEl.className = "n";
					nameEl.textContent = row.name;
					const descEl = document.createElement("div");
					descEl.className = "d";
					descEl.textContent = row.description;
					text.append(nameEl, descEl);
					line.append(box, text);
					box.addEventListener("change", () => {
						box.disabled = true;
						toggleSkill(id, row.slug ?? "").then((selection) => {
							picked.clear();
							for (const slug of selection.selected) picked.add(slug);
							box.checked = picked.has(row.slug ?? "");
							box.disabled = false;
						}).catch((e) => {
							note(String(e?.message ?? e), true);
							box.checked = picked.has(row.slug ?? "");
							box.disabled = false;
						});
					});
					bodyEl.appendChild(line);
				}
			};
			const load = () => {
				bodyEl.textContent = "";
				bodyEl.textContent = "加载中…";
				(async () => {
					try {
						const [skillBody, selectionBody] = await Promise.all([api$1("GET", SMC_API.skills), sessionId === void 0 ? Promise.resolve({
							selection: { selected: [] },
							table: ""
						}) : api$1("POST", SMC_API.contextsGet, { sessionId })]);
						const rows = skillBody.items.filter((s) => s.level === "user" && s.linked && typeof s.slug === "string" && s.slug !== "");
						render(rows, selectionBody.selection, selectionBody.table);
					} catch (e) {
						bodyEl.textContent = "";
						note(String(e?.message ?? e), true);
					}
				})();
			};
			refresh.addEventListener("click", () => {
				syncConversation();
				load();
			});
			load();
		}
		/** Mount the sidebar entry with the family's self-healing pattern. */
		function mountSidebarEntry(ctx) {
			const run = () => {
				ensureStyle();
				const entry = buildEntry(() => {
					openPanel(entry);
				});
				document.body.appendChild(entry);
				const openOnBoot = readOpenFlag();
				let bootOpened = false;
				const openIfPending = () => {
					if (!openOnBoot || bootOpened) return;
					bootOpened = true;
					openPanel(entry);
				};
				const rootObserver = new MutationObserver(() => {
					if (document.body.contains(entry) && placeEntry(entry)) return;
					placeEntry(entry);
				});
				const waitObserver = new MutationObserver(() => {
					if (!placeEntry(entry)) return;
					rootObserver.observe(document.body, {
						childList: true,
						subtree: true
					});
					waitObserver.disconnect();
					openIfPending();
				});
				if (placeEntry(entry) && document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]") !== null) {
					rootObserver.observe(document.body, {
						childList: true,
						subtree: true
					});
					openIfPending();
				} else waitObserver.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					waitObserver.disconnect();
					rootObserver.disconnect();
					entry.remove();
					document.getElementById("smc-fp")?.remove();
				};
			};
			try {
				ctx.effect(run, "dsh-s-m-c-center: sidebar");
			} catch (error) {
				console.warn("[dsh-s-m-c-center] sidebar mount failed:", error);
			}
		}
		//#endregion
		//#region src/client/shared/locales.ts
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			title: "工具管理",
			description: "管理技能、MCP 服务器与本地 CLI 工具（MCP 为真实连接）。",
			expand: "展开",
			collapse: "收起",
			notExposed: "当前部署未向此客户端提供该插件的设置命名空间。",
			readOnly: "设置文档为只读，无法保存更改。",
			unsaved: "未保存",
			discard: "放弃更改",
			save: "保存",
			saving: "保存中…",
			saveFailed: "保存未成功，请重试。",
			inherit: "继承",
			overridden: "已覆盖",
			reset: "重置",
			invalid: "输入无效",
			enabled: "启用插件",
			enabledHint: "关闭后，路由与 MCP 连接会全部停止。",
			announce: "向 Agent 公告",
			announceHint: "在系统提示中向每个 Agent 说明本插件的存在与能力。",
			on: "开",
			off: "关",
			tabSkills: "Skills 技能",
			tabMcp: "MCP 服务",
			tabCli: "CLI 工具",
			tabGuide: "使用说明",
			panelMcp: "MCP 服务器",
			panelCli: "本地 CLI 工具",
			panelUninstall: "卸载准备",
			panelGuide: "使用说明",
			guideIntro: "本插件把 agent 的三类工具（技能 / MCP / CLI）收在一个设置页里，技能还带一层按会话注入的开关。下面按类别说明各自是怎么工作的；最下方是卸载前的准备。",
			guideSkillsH: "技能（Skills）",
			guideStoreH: "储存库与目录联接",
			guideStoreP: "用户级技能的正本统一放在储存库的 skills/ 目录；各个 skills 目录里看到的是指向正本的目录联接。你不用管联接——界面上只有「启用 / 不启用」。",
			guideEnableH: "启用 / 不启用",
			guideEnableP: "启用 = 在对应 skills 目录注入联接，AI 立刻能用；不启用 = 移除联接，AI 完全看不到。两种情况都不改写 SKILL.md。项目级技能就地管理，仍按前言里的开关。",
			guideSessionH: "会话技能注入",
			guideSessionP: "「启用」之上还有一层\"注入\"：设置页的「会话默认」决定每个新对话带哪些技能；侧边栏小窗和对话里的 skill_select / skill_query 管理单个对话的增减。注入由本插件的影子目录接管——AI 看到的技能目录由这里生成（含 smc-skill-index 索引行），未注入的技能不能加载，/技能名 手势不受影响。容器目录（只有 DESCRIPTION.md）同样可注入，正文即该组说明。",
			guideMcpH: "MCP 服务器",
			guideConnectH: "真实连接",
			guideConnectP: "激活的服务器经 @deepseek-ai/dsh-mcp-client 真正连接，工具注册为 mcp__<server>__<tool>——不是只写了一份配置。连接失败会在那一行显示原因。",
			guideArchiveH: "激活 / 归档",
			guideArchiveP: "归档 = 把定义移到 mcp-archive.json：不连接、不公告，但完整保留；点「激活」随时移回 mcp.json 并重新连接。编辑一条已归档的服务器再保存，等同于激活它。",
			guideCliH: "本地 CLI 工具",
			guideDiscoverH: "发现与体检",
			guideDiscoverP: "自动发现 skill 内嵌的 CLI（scripts/run-cli）与登记的系统 CLI（gh / git 等），探测是否安装、版本、是否需更新、API-Key 状态，并列出子命令。",
			guideAnnounceH: "公告 / 隐藏",
			guideAnnounceP: "开关只决定「是否把这个 CLI 写进给 AI 的公告」——CLI 由系统安装，插件无法启停它。随 skills 安装的 CLI（标「技能 CLI」）建议保持隐藏：它们主要供所属 skill 自己调用，公告出去只会撑大系统提示。",
			guideDataH: "数据放在哪里",
			guideDataP: "插件的全部数据都在统一储存库（默认 ~/.dsh/S-M-C，可用 DSH_STORE_ROOT 改位）：skills/ 放技能正本、mcp.json 放激活的服务器、mcp-archive.json 放归档的、cli.json 放 CLI 登记表。密码与环境变量为明文，文件权限 0600 需自行保证。",
			sourceSystem: "系统 CLI",
			cliVirtualTitle: "关于本列表",
			cliVirtualHint: "这里自动发现技能自带的 CLI（scripts/run-cli），也可在下方登记系统命令；每一行都可删除或设为「隐藏」。本行只是说明，可随时删除。",
			skillList: "技能列表",
			groupNative: "原生",
			groupStored: "储存库",
			groupRegistered: "已登记",
			registerSkill: "登记外部技能（正本留在原地，仅写入登记表）",
			refreshRegistry: "溯源刷新",
			registerSelected: "登记选中 ({n})",
			newServer: "新建 / 编辑服务器",
			registerCli: "登记系统 CLI",
			modeForm: "表单",
			modeJson: "JSON",
			refresh: "刷新",
			edit: "编辑",
			delete: "删除",
			confirmDelete: "再次点击确认删除",
			add: "添加",
			testConnect: "测试连接",
			testing: "测试中…",
			loading: "加载中…",
			chooseFolder: "选择文件夹",
			scanDir: "扫描目录",
			scanning: "扫描中…",
			rollback: "撤销迁移",
			rollingBack: "撤销中…",
			probe: "探测",
			probing: "探测中…",
			details: "详情",
			announceTitle: "向 AI 公告",
			announceReading: "读取中…",
			announceOnState: "已开启",
			announceOffState: "已关闭",
			announceOnNote: "开启后，插件会在每个智能体的系统提示中声明自身能力（技能 / MCP / CLI 管理）。",
			announceOffNote: "关闭后，则完全不向 AI 暴露本插件的存在与能力。",
			persistA: "设置持久化到",
			persistB: "命名空间，写在",
			persistC: "；切换即时生效，无需重启。",
			pluginDisabled: "插件已禁用：路由与 MCP 连接、CLI 探测均已停止，重新启用后刷新即可恢复。",
			stConnecting: "连接中",
			stRunning: "运行中",
			stFailed: "失败",
			stStopped: "已停止",
			stInstalled: "已安装",
			stNotFound: "未找到",
			stNotConnected: "未连接",
			suffixArchived: " （已归档）",
			suffixHidden: " （已隐藏）",
			suffixUntracked: " （⚠ 无记录联接）",
			suffixOversize: " （超过 10G 上限）",
			suffixDir: " (目录)",
			suffixFile: " (文件)",
			badgeArchive: "归档库",
			badgeActive: "已启用",
			badgeSkill: "Skill",
			cliAdvertised: "公告",
			cliHidden: "隐藏",
			cliSkillSource: "技能 CLI",
			mcpTabManage: "管理",
			mcpTabCreate: "新建",
			activate: "激活",
			archive: "归档",
			btnLink: "联接",
			btnUnlink: "断开",
			tipLink: "在技能目录里建立联接，AI 立刻能看到它",
			tipUnlink: "移除联接；技能正本仍留在储存库，随时可重新联接",
			btnMigrate: "迁移入库",
			btnUnregister: "取消登记",
			btnVerify: "验证",
			btnDeleteLink: "删除联接",
			levelProject: "项目级",
			levelUser: "用户级",
			levelStore: "储存库级",
			emptySkills: "没有发现技能",
			emptySkillMatch: "没有匹配的技能",
			emptyMcp: "尚未配置任何 MCP 服务器",
			emptyMcpMatch: "没有匹配的服务器",
			emptyCli: "未发现 CLI 工具",
			emptyCliMatch: "没有匹配的 CLI",
			phSearchSkill: "搜索技能名称…",
			phSearchServer: "搜索服务器名称…",
			phSearchCli: "搜索 CLI 名称…",
			phRegisterDir: "目录路径（向下两层扫描 SKILL.md / DESCRIPTION.md，单技能上限 10G）",
			phCliName: "CLI 命令名，例如 gh",
			phCliCall: "调用名（可留空，默认同命令名）",
			phServerName: "例如 github",
			fieldName: "名称 name",
			fieldTransport: "传输 transport",
			fieldCommand: "命令 command",
			fieldArgs: "参数 args（每行一个）",
			fieldEnv: "环境变量 env（KEY=VALUE 每行一个）",
			fieldCwd: "工作目录 cwd",
			fieldUrl: "URL",
			fieldHeaders: "请求头 headers（KEY=VALUE 每行一个）",
			rowExists: "存在",
			rowPath: "路径",
			rowVersion: "版本",
			rowNeedUpdate: "需要更新",
			rowApiKey: "API Key",
			rowKeyError: "Key 错误",
			yesUpdateRecommended: "是（建议 update）",
			no: "否",
			configured: "已配置",
			msgEnterCliName: "请输入 CLI 命令名",
			msgJsonFailed: "JSON 解析失败：{error}",
			msgSaved: "已保存 {name}",
			msgConnectOk: "连接成功",
			msgConnectFailed: "连接失败：{error}",
			msgActivated: "已激活 {name}",
			msgArchived: "已归档 {name}",
			msgRollbackOk: "已撤销迁移，恢复 {moved} 个技能到原位置",
			msgRollbackPartial: "恢复 {moved} 个技能，{failed} 个失败",
			msgEnterDir: "请输入目录路径",
			msgNoImportable: "未发现可登记的技能",
			msgSelectFirst: "请先勾选要登记的技能",
			msgRegistered: "已登记 {n} 个技能",
			msgVerifyTracked: "联接有效（有账本记录）→ ",
			msgVerifyUntracked: "联接有效（无账本记录）→ ",
			msgRefreshOk: "溯源刷新完成：{n} 条记录均存在",
			msgRefreshMissing: "溯源刷新：{n} 条记录的目录已不存在 → ",
			contextTitle: "会话默认",
			contextNote: "这里列出的是**已联接**的技能（真实技能目录里存在的）。注入（开）= 进入每个尚未单独配置的新对话；对话里的 agent 也能自己开关（写入该会话自己的配置）。未联接的技能不在此列。",
			contextDefaultItem: "新会话的起始技能",
			contextCount: "已注入 {n} 项",
			contextNoCandidates: "没有已联接的技能（先在下方技能列表里「启用」以创建联接）",
			injectOn: "注入",
			injectOff: "隐藏",
			contextTableNote: "以上状态存在一张中转配置表里（设置页与小窗读的是同一份）：{path}",
			msgContextApplied: "已保存，本会话共注入 {n} 个技能（{state}）",
			msgContextLive: "已即时生效",
			msgContextSaved: "会话未运行，下次启动生效",
			detailWhenToUse: "何时使用",
			helpToggle: "/help 帮助文本",
			cliSkillPrefix: "技能",
			uninstallIntro: "准备卸载本插件时，先在这里把托管的数据归还回系统默认位置，再手动删除储存库目录。",
			uninstallSkillsTitle: "技能迁移",
			uninstallSkillsNote: "储存库里有技能时，「撤销迁移」把它们移回原始位置、联接一并移除，agent 看到的技能与迁移前完全一致；储存库空着而 skills 目录里还有技能时，按钮变为「迁移」，可随时把技能重新收进储存库。",
			uninstallMcpTitle: "MCP 注入",
			uninstallMcpNote: "「MCP 全部注入」把归档的服务器一次性移回 mcp.json 并重新连接。此操作无需撤回：不需要的服务器随时可以在「MCP 服务」页单独停用或删除。",
			uninstallFilesTitle: "需要手动删除的文件",
			uninstallFilesNote: "插件卸载不会清理数据。移除插件后，请手动删除整个储存库目录；删除目录即包含以下全部内容：",
			uninstallFilesList: "skills/（技能正本）、mcp.json（激活的 MCP 服务器）、mcp-archive.json（归档的 MCP 服务器）、cli.json（CLI 登记表）",
			uninstallSettingsPath: "另外，~/.dsh/settings.yaml 中的 dsh-s-m-c-center 配置块可以一并删掉。",
			uninstallNothing: "储存库中没有技能、skills 目录也没有待迁移的技能，归档里也没有 MCP 服务器——无需任何操作。",
			migrateSkills: "迁移",
			migratingSkills: "迁移中…",
			restoreAllMcp: "MCP 全部注入",
			restoringMcp: "注入中…",
			msgMigrateDone: "已迁移 {moved} 个技能。",
			msgRestoreDone: "已注入 {restored} 个 MCP 服务器。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			title: "Tool Manager",
			description: "Manage skills, MCP servers and local CLI tools (MCP connects for real).",
			expand: "Show",
			collapse: "Hide",
			notExposed: "This deployment does not expose the plugin settings namespace to this client.",
			readOnly: "The settings document is read-only; changes cannot be saved.",
			unsaved: "Unsaved",
			discard: "Discard",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The save did not land; please retry.",
			inherit: "Inherit",
			overridden: "Overridden",
			reset: "Reset",
			invalid: "Invalid",
			enabled: "Enable plugin",
			enabledHint: "When off, routes and MCP connections all stop.",
			announce: "Announce to agent",
			announceHint: "Describe this plugin and its capabilities in every agent system prompt.",
			on: "On",
			off: "Off",
			tabSkills: "Skills",
			tabMcp: "MCP servers",
			tabCli: "CLI tools",
			tabGuide: "Guide",
			panelMcp: "MCP servers",
			panelCli: "Local CLI tools",
			panelUninstall: "Uninstall preparation",
			panelGuide: "Guide",
			guideIntro: "The plugin gathers the agent’s three tool families (skills, MCP servers, local CLI tools) into one settings page, and skills gain a per-conversation injection layer. Below is how each of them works; the last section covers uninstalling.",
			guideSkillsH: "Skills",
			guideStoreH: "The store and its links",
			guideStoreP: "The canonical copy of every user-level skill lives under skills/ in the store; what each skills directory shows is a junction pointing at it. You never manage the links — the UI only offers enable / disable.",
			guideEnableH: "Enable / disable",
			guideEnableP: "Enabling injects a junction into the matching skills directory and the AI can use the skill right away; disabling removes it and the AI sees nothing. Neither rewrites SKILL.md. Project-level skills stay in place and still switch through their frontmatter.",
			guideSessionH: "Per-conversation skill injection",
			guideSessionP: "On top of \"enable\" sits a second layer — injection: the \"session default\" decides what every new conversation starts with, while the sidebar panel and the in-conversation skill_select / skill_query tools adjust a single conversation. Injection is served by this plugin's shadow catalog: the skill catalog the AI sees is generated here (including the smc-skill-index line), non-injected skills cannot be loaded, and the /skill-name gesture is unaffected. Container directories (DESCRIPTION.md only) inject too — their body is the group description.",
			guideMcpH: "MCP servers",
			guideConnectH: "Real connections",
			guideConnectP: "Enabled servers are really connected through @deepseek-ai/dsh-mcp-client and register their tools as mcp__<server>__<tool> — not merely a config entry. A failed connection shows its reason on the row.",
			guideArchiveH: "Enable / archive",
			guideArchiveP: "Archiving moves a definition to mcp-archive.json: not connected, not announced, but kept whole; “enable” moves it back to mcp.json and reconnects it. Editing an archived server and saving has the same effect as enabling it.",
			guideCliH: "Local CLI tools",
			guideDiscoverH: "Discovery and health check",
			guideDiscoverP: "Finds the CLIs a skill embeds (scripts/run-cli) plus registered system CLIs (gh, git …), probing whether each is installed, its version, whether an update is due, its API-key state, and its subcommands.",
			guideAnnounceH: "Announce / hide",
			guideAnnounceP: "The switch only decides whether the CLI is written into the agent announcement — the plugin cannot start or stop a CLI the system installs. Skill-provided CLIs (labelled “Skill CLI”) are best left hidden: their own skill calls them, and announcing them only pads the system prompt.",
			guideDataH: "Where the data lives",
			guideDataP: "Everything this plugin stores lives in one place — by default ~/.dsh/S-M-C (relocate with DSH_STORE_ROOT): skills/ holds the canonical skill copies, mcp.json the enabled servers, mcp-archive.json the archived ones, cli.json the CLI registry. Secrets and env vars are plain text; file permissions (0600) are up to you.",
			sourceSystem: "System CLI",
			cliVirtualTitle: "About this list",
			cliVirtualHint: "Skill-wrapped CLIs (scripts/run-cli) are discovered automatically; register system commands below. Every row can be deleted or set to hidden — this row is just the note, delete it whenever you like.",
			skillList: "Skills",
			groupNative: "Native",
			groupStored: "Stored",
			groupRegistered: "Registered",
			registerSkill: "Register external skills (copies stay put; only the ledger is written)",
			refreshRegistry: "Refresh traceability",
			registerSelected: "Register selected ({n})",
			newServer: "New / edit server",
			registerCli: "Register a system CLI",
			modeForm: "Form",
			modeJson: "JSON",
			refresh: "Refresh",
			edit: "Edit",
			delete: "Delete",
			confirmDelete: "Click again to confirm",
			add: "Add",
			testConnect: "Test connection",
			testing: "Testing…",
			loading: "Loading…",
			chooseFolder: "Choose folder",
			scanDir: "Scan directory",
			scanning: "Scanning…",
			rollback: "Undo migration",
			rollingBack: "Undoing…",
			probe: "Probe",
			probing: "Probing…",
			details: "Details",
			announceTitle: "Announce to AI",
			announceReading: "Loading…",
			announceOnState: "On",
			announceOffState: "Off",
			announceOnNote: "When on, the plugin declares what it can do (skills / MCP / CLI) in every agent system prompt.",
			announceOffNote: "When off, the plugin is completely invisible to the AI — neither its presence nor its capabilities.",
			persistA: "The setting persists under the",
			persistB: " namespace in",
			persistC: "; switching takes effect immediately, no restart needed.",
			pluginDisabled: "Plugin disabled: routes, MCP connections and CLI probing have all stopped. Re-enable it and refresh to recover.",
			stConnecting: "Connecting",
			stRunning: "Running",
			stFailed: "Failed",
			stStopped: "Stopped",
			stInstalled: "Installed",
			stNotFound: "Not found",
			stNotConnected: "Not connected",
			suffixArchived: " (archived)",
			suffixHidden: " (hidden)",
			suffixUntracked: " (⚠ untracked link)",
			suffixOversize: " (over the 10 GB cap)",
			suffixDir: " (dir)",
			suffixFile: " (file)",
			badgeArchive: "Archive",
			badgeActive: "Enabled",
			badgeSkill: "Skill",
			cliAdvertised: "Advertised",
			cliHidden: "Hidden",
			cliSkillSource: "Skill CLI",
			mcpTabManage: "Manage",
			mcpTabCreate: "Create",
			activate: "Enable",
			archive: "Archive",
			btnLink: "Link",
			btnUnlink: "Disconnect",
			tipLink: "Create the link in the skills directory so the agent sees it at once",
			tipUnlink: "Remove the link; the canonical copy stays in the store and can be linked again",
			btnMigrate: "Move to store",
			btnUnregister: "Unregister",
			btnVerify: "Verify",
			btnDeleteLink: "Delete link",
			levelProject: "Project",
			levelUser: "User",
			levelStore: "Store",
			emptySkills: "No skills found",
			emptySkillMatch: "No matching skills",
			emptyMcp: "No MCP servers configured yet",
			emptyMcpMatch: "No matching servers",
			emptyCli: "No CLI tools found",
			emptyCliMatch: "No matching CLIs",
			phSearchSkill: "Search skill names…",
			phSearchServer: "Search server names…",
			phSearchCli: "Search CLI names…",
			phRegisterDir: "Directory path (scans two levels down for SKILL.md / DESCRIPTION.md, 10 GB cap per skill)",
			phCliName: "CLI command name, e.g. gh",
			phCliCall: "Invoked name (optional; defaults to the command name)",
			phServerName: "e.g. github",
			fieldName: "Name (name)",
			fieldTransport: "Transport (transport)",
			fieldCommand: "Command (command)",
			fieldArgs: "Args (one per line)",
			fieldEnv: "Env (KEY=VALUE, one per line)",
			fieldCwd: "Working directory (cwd)",
			fieldUrl: "URL",
			fieldHeaders: "Headers (KEY=VALUE, one per line)",
			rowExists: "Exists",
			rowPath: "Path",
			rowVersion: "Version",
			rowNeedUpdate: "Update needed",
			rowApiKey: "API key",
			rowKeyError: "Key error",
			yesUpdateRecommended: "Yes (update recommended)",
			no: "No",
			configured: "Configured",
			msgEnterCliName: "Enter the CLI command name",
			msgJsonFailed: "JSON parse failed: {error}",
			msgSaved: "Saved {name}",
			msgConnectOk: "Connected",
			msgConnectFailed: "Connection failed: {error}",
			msgActivated: "Enabled {name}",
			msgArchived: "Archived {name}",
			msgRollbackOk: "Migration undone: {moved} skills restored to their original locations",
			msgRollbackPartial: "Restored {moved} skills, {failed} failed",
			msgEnterDir: "Enter a directory path",
			msgNoImportable: "No registrable skills found",
			msgSelectFirst: "Select the skills to register first",
			msgRegistered: "Registered {n} skills",
			msgVerifyTracked: "Link is valid (tracked in the ledger) → ",
			msgVerifyUntracked: "Link is valid (no ledger record) → ",
			msgRefreshOk: "Traceability refresh done: all {n} records exist",
			msgRefreshMissing: "Traceability refresh: {n} record(s) missing → ",
			contextTitle: "Session default",
			contextNote: "This lists **linked** skills only — what actually sits in the skill roots. Injected (on) skills reach every new conversation without a selection of its own; the agent can also flip its own skills in-conversation (written to that conversation's config). Unlinked skills are not listed here.",
			contextDefaultItem: "Starting skills for new conversations",
			contextCount: "{n} injected",
			contextNoCandidates: "No linked skills (enable one in the skill list below to create the link)",
			injectOn: "Injected",
			injectOff: "Hidden",
			contextTableNote: "All of the above lives in one relay table, read by both this page and the sidebar: {path}",
			msgContextApplied: "Saved; {n} skill(s) injected for this conversation ({state})",
			msgContextLive: "applied live",
			msgContextSaved: "session idle; takes effect on next start",
			detailWhenToUse: "When to use",
			helpToggle: "/help text",
			cliSkillPrefix: "Skill",
			uninstallIntro: "Before uninstalling this plugin, give its managed data back to the system default locations here, then delete the store directory by hand.",
			uninstallSkillsTitle: "Skills migration",
			uninstallSkillsNote: "When the store holds skills, \"Undo migration\" moves them back to their original locations and removes the links — what the agent sees is exactly what it saw before the migration. When the store is empty but skills still sit in the skills directories, the button turns into \"Migrate\" to bring them back into the store.",
			uninstallMcpTitle: "MCP injection",
			uninstallMcpNote: "\"Inject all MCP\" moves every archived server back into mcp.json in one pass and reconnects it. No undo is provided: a server you no longer need can be archived or deleted individually on the MCP tab at any time.",
			uninstallFilesTitle: "Files to remove by hand",
			uninstallFilesNote: "Uninstalling the plugin does not clean up its data. After removal, delete the whole store directory; deleting it covers everything listed below:",
			uninstallFilesList: "skills/ (canonical skill copies), mcp.json (active MCP servers), mcp-archive.json (archived MCP servers), cli.json (CLI registry)",
			uninstallSettingsPath: "Also feel free to delete the dsh-s-m-c-center block in ~/.dsh/settings.yaml.",
			uninstallNothing: "The store holds no skills, no skills await migration, and no MCP servers are archived — nothing to do.",
			migrateSkills: "Migrate",
			migratingSkills: "Migrating…",
			restoreAllMcp: "Inject all MCP",
			restoringMcp: "Injecting…",
			msgMigrateDone: "Migrated {moved} skills.",
			msgRestoreDone: "Injected {restored} MCP servers."
		};
		//#endregion
		//#region \0dsh-css:src/client/shared/settings-card.module.css.mjs
		const css = ".SY7nWG_manager{--sp-1:4px;--sp-2:8px;--sp-3:10px;--sp-4:12px;--sp-5:14px;--sp-6:20px;--r-sm:6px;--r-md:8px;--r-pill:999px;--line:#80808040;--line-strong:#80808061;--fill-1:#8080800f;--fill-2:#8080801f;--fill-3:#8080802e;--muted:gray;--danger:#e5534b;--danger-line:#e5534b6b;--danger-fill:#e5534b1a;--ok:#3fb950;--ok-line:#3fb9506b;--ok-fill:#3fb9501a;--focus:0 0 0 2px #80808059;gap:var(--sp-6);flex-direction:column;font-size:13px;line-height:1.5;display:flex}.SY7nWG_sectionPage{gap:var(--sp-4);flex-direction:column;max-width:1040px;display:flex}.SY7nWG_pageHeading{letter-spacing:.01em;margin:0;font-size:17px;font-weight:600}.SY7nWG_pageIntro{color:var(--muted);margin:0;font-size:13px}.SY7nWG_tabs{gap:var(--sp-1);border-bottom:1px solid var(--line);display:flex}.SY7nWG_tab,.SY7nWG_tabActive{font:inherit;color:inherit;padding:var(--sp-2) var(--sp-5);cursor:pointer;opacity:.68;background:0 0;border:none;border-bottom:2px solid #0000;margin-bottom:-1px;transition:opacity .12s,border-color .12s,background .12s}.SY7nWG_tab:hover{opacity:.9;background:var(--fill-1)}.SY7nWG_tab:focus-visible{box-shadow:var(--focus);border-radius:var(--r-sm) var(--r-sm) 0 0;outline:none}.SY7nWG_tabActive{opacity:1;border-bottom-color:currentColor;font-weight:600}.SY7nWG_panel{gap:var(--sp-6);flex-direction:column;display:flex}.SY7nWG_section{gap:var(--sp-3);flex-direction:column;display:flex}.SY7nWG_h{margin:0;font-size:14px;font-weight:600}.SY7nWG_hGrow{flex:auto;margin:0;font-size:14px;font-weight:600}.SY7nWG_groupH{margin:var(--sp-3) 0 var(--sp-1);color:var(--muted);text-transform:none;letter-spacing:.02em;font-size:12px;font-weight:600}.SY7nWG_docH1{margin:20px 0 0;font-size:15px;font-weight:600}.SY7nWG_inline{align-items:center;gap:var(--sp-2);flex-wrap:wrap;display:flex}.SY7nWG_row{align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);flex-wrap:wrap;transition:border-color .12s,background .12s;display:flex}.SY7nWG_row:hover{border-color:var(--line-strong);background:var(--fill-2)}.SY7nWG_row+.SY7nWG_row{margin-top:var(--sp-2)}.SY7nWG_main{flex:auto;min-width:200px}.SY7nWG_rowHead{flex:100%;min-width:0}.SY7nWG_name{align-items:center;gap:var(--sp-2);color:inherit;flex-wrap:wrap;font-weight:600;display:flex}.SY7nWG_nameText{overflow-wrap:anywhere;word-break:break-word;flex:auto;min-width:0}.SY7nWG_desc{color:var(--muted);text-overflow:ellipsis;white-space:nowrap;margin-top:2px;font-size:12px;overflow:hidden}.SY7nWG_badge{border-radius:var(--r-pill);background:var(--fill-3);white-space:nowrap;flex:none;padding:1px 8px;font-size:11px}.SY7nWG_status{color:var(--muted);white-space:nowrap;flex:none;font-size:11px;font-weight:400}.SY7nWG_switch{white-space:nowrap;cursor:pointer;user-select:none;flex:none;align-items:center;gap:6px;margin-left:auto;font-size:12px;display:inline-flex}.SY7nWG_switch input{-webkit-appearance:none;appearance:none;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--fill-2);cursor:pointer;flex:none;width:34px;height:18px;margin:0;transition:background .15s,border-color .15s;position:relative}.SY7nWG_switch input:after{content:\"\";background:var(--muted);border-radius:50%;width:12px;height:12px;transition:transform .15s,background .15s;position:absolute;top:2px;left:2px}.SY7nWG_switch input:checked{background:#80808073;border-color:#8080808c}.SY7nWG_switch input:checked:after{background:#fff;transform:translate(16px)}.SY7nWG_switch input:focus-visible{box-shadow:var(--focus);outline:none}.SY7nWG_switch input:disabled{opacity:.45;cursor:default}.SY7nWG_btn,.SY7nWG_btnPrimary,.SY7nWG_btnDanger,.SY7nWG_btnSuccess,.SY7nWG_btnActive{font:inherit;padding:var(--sp-1) var(--sp-3);border:1px solid var(--line-strong);border-radius:var(--r-sm);color:inherit;white-space:nowrap;cursor:pointer;background:0 0;font-size:12px;transition:background .12s,border-color .12s,opacity .12s}.SY7nWG_btn:hover,.SY7nWG_btnActive:hover{background:var(--fill-2)}.SY7nWG_btn:focus-visible,.SY7nWG_btnPrimary:focus-visible,.SY7nWG_btnDanger:focus-visible,.SY7nWG_btnSuccess:focus-visible,.SY7nWG_btnActive:focus-visible{box-shadow:var(--focus);outline:none}.SY7nWG_btn:disabled,.SY7nWG_btnPrimary:disabled,.SY7nWG_btnDanger:disabled,.SY7nWG_btnSuccess:disabled,.SY7nWG_btnActive:disabled{opacity:.45;cursor:default}.SY7nWG_btnPrimary{background:var(--fill-2);border-color:currentColor;font-weight:600}.SY7nWG_btnPrimary:hover{background:var(--fill-3)}.SY7nWG_btnDanger{color:var(--danger);border-color:var(--danger-line)}.SY7nWG_btnDanger:hover{background:var(--danger-fill)}.SY7nWG_btnSuccess{color:var(--ok);border-color:var(--ok-line);font-weight:600}.SY7nWG_btnSuccess:hover{background:var(--ok-fill)}.SY7nWG_btnActive{background:var(--fill-3);border-color:var(--line-strong);font-weight:600}.SY7nWG_error{color:var(--danger);font-size:12px}.SY7nWG_note,.SY7nWG_notExposed,.SY7nWG_readOnly{color:var(--muted);font-size:12px}.SY7nWG_noteLines{gap:var(--sp-1);color:var(--muted);flex-direction:column;font-size:12px;line-height:1.6;display:flex}.SY7nWG_noteLines>div{margin:0}.SY7nWG_noteFoot{padding-top:var(--sp-1);border-top:1px solid var(--line)}.SY7nWG_noteLines code{border-radius:var(--r-sm);background:var(--fill-2);padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.SY7nWG_disabledBanner{padding:var(--sp-2) var(--sp-3);border:1px solid var(--danger-line);border-radius:var(--r-md);background:var(--danger-fill);color:var(--danger);margin:0;font-size:12px}.SY7nWG_collapsible{border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);overflow:hidden}.SY7nWG_collapsibleHead{align-items:center;gap:var(--sp-2);box-sizing:border-box;width:100%;padding:var(--sp-2) var(--sp-3);color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;font-size:12px;display:flex}.SY7nWG_collapsibleHead:hover{background:var(--fill-2)}.SY7nWG_collapsibleHead:focus-visible{box-shadow:var(--focus);outline:none}.SY7nWG_collapsibleChev{width:12px;color:var(--muted);flex:none;font-size:10px}.SY7nWG_collapsibleLabel{overflow-wrap:anywhere;flex:auto;min-width:0;font-weight:600}.SY7nWG_collapsibleAction{color:var(--muted);flex:none;font-size:11px}.SY7nWG_collapsibleBody{gap:var(--sp-1);padding:0 var(--sp-3) var(--sp-2) calc(var(--sp-3) + 18px);color:var(--muted);flex-direction:column;font-size:12px;line-height:1.5;display:flex}.SY7nWG_collapsibleBody code{border-radius:var(--r-sm);background:var(--fill-2);padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.SY7nWG_pathList{gap:var(--sp-1);padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-2);user-select:all;overflow-wrap:anywhere;flex-direction:column;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;display:flex}.SY7nWG_pathMain{font-weight:600}.SY7nWG_pathSub{color:var(--muted)}.SY7nWG_descWrap{color:var(--muted);overflow-wrap:anywhere;word-break:break-word;min-width:0;font-size:12px;line-height:1.6}.SY7nWG_empty,.SY7nWG_loading{justify-content:center;align-items:center;gap:var(--sp-1);padding:28px var(--sp-4);border:1px dashed var(--line);border-radius:var(--r-md);color:var(--muted);text-align:center;flex-direction:column;font-size:12px;display:flex}.SY7nWG_loading{border-style:solid;animation:1.4s ease-in-out infinite SY7nWG_pulse}@keyframes SY7nWG_pulse{0%,to{opacity:1}50%{opacity:.55}}@media (prefers-reduced-motion:reduce){.SY7nWG_loading{animation:none}.SY7nWG_switch input,.SY7nWG_switch input:after,.SY7nWG_tab,.SY7nWG_row,.SY7nWG_btn,.SY7nWG_btnPrimary,.SY7nWG_btnDanger,.SY7nWG_btnSuccess,.SY7nWG_btnActive{transition:none}}.SY7nWG_emptyTitle{color:inherit;opacity:.85;font-size:13px;font-weight:600}.SY7nWG_emptyHint{max-width:46ch;font-size:12px}.SY7nWG_detail{margin:var(--sp-1) 0 0;padding:var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--fill-1);font-size:12px}.SY7nWG_pre{margin:var(--sp-2) 0 0;padding:var(--sp-2);border-radius:var(--r-sm);background:var(--fill-2);white-space:pre-wrap;word-break:break-word;max-height:320px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow:auto}.SY7nWG_scanList{gap:var(--sp-2);flex-direction:column;align-items:flex-start;display:flex}.SY7nWG_scanList>.SY7nWG_row{box-sizing:border-box;width:100%}.SY7nWG_input,.SY7nWG_inputGrow,.SY7nWG_inputMono,.SY7nWG_filterSelect{font:inherit;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--fill-1);color:inherit;box-sizing:border-box;padding:6px 8px;font-size:13px;transition:border-color .12s,box-shadow .12s,background .12s}.SY7nWG_input,.SY7nWG_inputMono{width:100%}.SY7nWG_inputGrow{flex:auto;width:auto;min-width:220px}.SY7nWG_inputMono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.SY7nWG_filterSelect{flex:none;width:auto}.SY7nWG_input:hover,.SY7nWG_inputGrow:hover,.SY7nWG_inputMono:hover,.SY7nWG_filterSelect:hover{border-color:#80808080}.SY7nWG_input:focus,.SY7nWG_inputGrow:focus,.SY7nWG_inputMono:focus,.SY7nWG_filterSelect:focus{background:var(--fill-2);box-shadow:var(--focus);border-color:#80808099;outline:none}.SY7nWG_input::placeholder,.SY7nWG_inputGrow::placeholder,.SY7nWG_inputMono::placeholder{color:var(--muted);opacity:.75}textarea.SY7nWG_input,textarea.SY7nWG_inputMono{resize:vertical;min-height:34px}.SY7nWG_form{gap:var(--sp-3);flex-direction:column;display:flex}.SY7nWG_fieldLabel{gap:var(--sp-1);flex-direction:column;display:flex}.SY7nWG_fieldName{color:var(--muted);font-size:12px}@media (width<=720px){.SY7nWG_row{flex-wrap:wrap}.SY7nWG_inputGrow{min-width:100%}.SY7nWG_tabs{scrollbar-width:thin;overflow-x:auto}.SY7nWG_tab,.SY7nWG_tabActive{padding:var(--sp-2) var(--sp-3)}}";
		const tagId = "dsh-s-m-c-center/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-s-m-c-center";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "SY7nWG_badge",
			"btn": "SY7nWG_btn",
			"btnActive": "SY7nWG_btnActive",
			"btnDanger": "SY7nWG_btnDanger",
			"btnPrimary": "SY7nWG_btnPrimary",
			"btnSuccess": "SY7nWG_btnSuccess",
			"collapsible": "SY7nWG_collapsible",
			"collapsibleAction": "SY7nWG_collapsibleAction",
			"collapsibleBody": "SY7nWG_collapsibleBody",
			"collapsibleChev": "SY7nWG_collapsibleChev",
			"collapsibleHead": "SY7nWG_collapsibleHead",
			"collapsibleLabel": "SY7nWG_collapsibleLabel",
			"desc": "SY7nWG_desc",
			"descWrap": "SY7nWG_descWrap",
			"detail": "SY7nWG_detail",
			"disabledBanner": "SY7nWG_disabledBanner",
			"docH1": "SY7nWG_docH1",
			"empty": "SY7nWG_empty",
			"emptyHint": "SY7nWG_emptyHint",
			"emptyTitle": "SY7nWG_emptyTitle",
			"error": "SY7nWG_error",
			"fieldLabel": "SY7nWG_fieldLabel",
			"fieldName": "SY7nWG_fieldName",
			"filterSelect": "SY7nWG_filterSelect",
			"form": "SY7nWG_form",
			"groupH": "SY7nWG_groupH",
			"h": "SY7nWG_h",
			"hGrow": "SY7nWG_hGrow",
			"inline": "SY7nWG_inline",
			"input": "SY7nWG_input",
			"inputGrow": "SY7nWG_inputGrow",
			"inputMono": "SY7nWG_inputMono",
			"loading": "SY7nWG_loading",
			"main": "SY7nWG_main",
			"manager": "SY7nWG_manager",
			"name": "SY7nWG_name",
			"nameText": "SY7nWG_nameText",
			"notExposed": "SY7nWG_notExposed",
			"note": "SY7nWG_note",
			"noteFoot": "SY7nWG_noteFoot",
			"noteLines": "SY7nWG_noteLines",
			"pageHeading": "SY7nWG_pageHeading",
			"pageIntro": "SY7nWG_pageIntro",
			"panel": "SY7nWG_panel",
			"pathList": "SY7nWG_pathList",
			"pathMain": "SY7nWG_pathMain",
			"pathSub": "SY7nWG_pathSub",
			"pre": "SY7nWG_pre",
			"pulse": "SY7nWG_pulse",
			"readOnly": "SY7nWG_readOnly",
			"row": "SY7nWG_row",
			"rowHead": "SY7nWG_rowHead",
			"scanList": "SY7nWG_scanList",
			"section": "SY7nWG_section",
			"sectionPage": "SY7nWG_sectionPage",
			"status": "SY7nWG_status",
			"switch": "SY7nWG_switch",
			"tab": "SY7nWG_tab",
			"tabActive": "SY7nWG_tabActive",
			"tabs": "SY7nWG_tabs"
		};
		//#endregion
		//#region src/client/shared/ui.tsx
		/**
		* Primitive UI atoms shared by the three panels.
		*
		* These are deliberately dumb: no API access, no data fetching, no knowledge of
		* skills/MCP/CLI. They exist so the panels stay declarative and the class-name
		* vocabulary lives in exactly one place per widget.
		*/
		/** A single styled button; `type=button` so it never submits a form. */
		function Button({ children, onClick, disabled, variant = "default", title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: variant === "primary" ? settings_card_module_css_default.btnPrimary : variant === "danger" ? settings_card_module_css_default.btnDanger : variant === "active" ? settings_card_module_css_default.btnActive : variant === "success" ? settings_card_module_css_default.btnSuccess : settings_card_module_css_default.btn,
				onClick,
				disabled,
				title,
				children
			});
		}
		/**
		* A destructive button that needs two clicks, and forgets the first one as
		* soon as the pointer goes anywhere else.
		*
		* The arming state lives here rather than in the panel hooks: three panels need
		* it and each had grown its own copy, which also meant an armed button stayed
		* armed until it was clicked again — leaving a red "click again to confirm" on
		* screen while the user went off and did something else entirely. Clicking
		* anywhere but this button now disarms it, so the row always falls back to its
		* ordinary label.
		*/
		function ConfirmButton({ label, confirmLabel, onConfirm, disabled, variant = "default" }) {
			const [armed, setArmed] = (0, react.useState)(false);
			const box = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!armed) return void 0;
				const away = (event) => {
					const target = event.target;
					if (target instanceof Node && box.current?.contains(target) === true) return;
					setArmed(false);
				};
				document.addEventListener("pointerdown", away, true);
				return () => {
					document.removeEventListener("pointerdown", away, true);
				};
			}, [armed]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: box,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					variant,
					disabled,
					onClick: () => {
						if (!armed) {
							setArmed(true);
							return;
						}
						setArmed(false);
						onConfirm();
					},
					children: armed ? confirmLabel : label
				})
			});
		}
		/** A labelled form row (label wraps the control so clicks focus it). */
		function Field({ label, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: settings_card_module_css_default.fieldLabel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.fieldName,
					children: label
				}), children]
			});
		}
		/** A read-only `label: value` row used by the CLI probe detail pane. */
		function StateRow({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.inline,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.desc,
					style: { minWidth: 92 },
					children: [label, ":"]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.desc,
					children: value || "—"
				})]
			});
		}
		/** Checkbox styled as a toggle switch. */
		function Switch({ checked, onChange, disabled, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: settings_card_module_css_default.switch,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					disabled,
					onChange,
					role: "switch"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		/** Small pill for source labels and subcommand chips. */
		function Badge({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: settings_card_module_css_default.badge,
				children
			});
		}
		/** Placeholder shown when a list has no rows. */
		function EmptyState({ title, hint }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.empty,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.emptyTitle,
					children: title
				}), hint ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.emptyHint,
					children: hint
				}) : null]
			});
		}
		/** Inline failure message. */
		function ErrorText({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.error,
				children
			});
		}
		/** Inline loading placeholder. `t` keeps the copy in the plugin dictionary. */
		function Loading({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.loading,
				children: t("loading")
			});
		}
		//#endregion
		//#region src/client/shared/format.ts
		/**
		* Pure formatting helpers for the manager UI. No React, no framework imports —
		* everything here is a plain function so it can be unit-tested in isolation.
		*/
		/**
		* A description collapsed onto one line and capped, for a row's secondary line.
		*
		* `description: |` keeps its newlines, and a row that has to stay one line tall
		* cannot take them. CSS does the visual ellipsis; the cap keeps the DOM from
		* carrying a novel around.
		*/
		function shortText(text, max = 90) {
			const flat = text.replace(/\s+/g, " ").trim();
			return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
		}
		/** Parse `KEY=VALUE` lines into an object (blank/malformed lines are dropped). */
		function parseKv(text) {
			const obj = {};
			if (!text) return obj;
			for (const line of text.split(/\n/)) {
				const t = line.trim();
				if (!t) continue;
				const i = t.indexOf("=");
				if (i < 0) continue;
				obj[t.slice(0, i).trim()] = t.slice(i + 1).trim();
			}
			return obj;
		}
		/** Render an object as `KEY=VALUE` lines (inverse of {@link parseKv}). */
		function kvText(obj) {
			return Object.keys(obj || {}).map((k) => k + "=" + (obj || {})[k]).join("\n");
		}
		/**
		* Fill `{name}` placeholders in a translated string.
		*
		* Copy carries placeholders (never positional concatenation) so each language
		* keeps its own word order — `{n} 条已归档` versus `{n} of them are archived`.
		* An unknown key is left verbatim rather than blanked, so a missing value is
		* visible instead of silently swallowing a word.
		*/
		function format(tpl, vars) {
			return tpl.replace(/\{(\w+)\}/g, (whole, key) => Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
		}
		/** Normalise an unknown thrown value into a display string. */
		function errorText(e) {
			return String(e?.message || e);
		}
		/** Strip a lower-cased query down for case-insensitive matching. */
		function normalizeQuery(query) {
			return query.trim().toLowerCase();
		}
		//#endregion
		//#region src/client/features/skills/SkillsPanel.tsx
		/**
		* Skills tab view — one list, four groups.
		*
		* Every row shows which of the four groups it belongs to (native / stored /
		* registered / the link state as its own flag) and offers exactly the
		* operations its group allows:
		*
		* - native:      迁移入库 (canonical copy → store, link back in place)
		* - stored:      联接 / 删除 (the canonical copy goes — the only delete)
		* - registered:  联接 / 取消登记 (the external copy stays where it lives)
		* - untracked:   a link on disk with no ledger record — red flag, with
		*                验证 / 删除联接 instead of the normal actions
		*
		* Deletion is store-only: the plugin destroys nothing but its own canonical
		* copies, because everything else on disk belongs to the user or to another
		* tool. The row offers it exactly where it applies.
		*
		* Migration is deliberately one-way here. Undoing it is an uninstall-time
		* concern, so the bulk 撤销迁移 lives on the Guide tab's uninstall prep.
		*
		* Pure presentation over {@link useSkills}: it owns no state beyond the scan
		* section and never calls the API directly.
		*/
		/** Locale key per group badge. */
		const GROUP_KEY = {
			native: "groupNative",
			stored: "groupStored",
			registered: "groupRegistered"
		};
		/** Skills tab. */
		function SkillsPanel({ skills, contexts, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextSection, {
						contexts,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.inline,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.hGrow,
							children: t("skillList")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							onClick: skills.reload,
							disabled: skills.refreshing,
							children: t("refresh")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toolbar, {
						skills,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Messages, { skills }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillList, {
						skills,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RegisterSection, {
						skills,
						t
					})
				]
			});
		}
		/** Search box. */
		function Toolbar({ skills, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.inline,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: settings_card_module_css_default.inputGrow,
					placeholder: t("phSearchSkill"),
					value: skills.query,
					onChange: (e) => {
						skills.setQuery(e.target.value);
					}
				})
			});
		}
		/** Errors and transient action feedback. */
		function Messages({ skills }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [skills.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: skills.message }) : null, skills.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: skills.error }) : null] });
		}
		/**
		* Phase two: the workspace default skill selection, folded behind a toggle —
		* day-to-day the page is about the stored list, so the block stays collapsed.
		*
		* Only the default (`_default`) is offered: it is the selection every
		* conversation without a file of its own inherits, so it is the one a human
		* needs to set. A conversation's own selection is the agent's business — it
		* writes one through the `skill_select` tool at any time.
		*/
		function ContextSection({ contexts, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.collapsible,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: settings_card_module_css_default.collapsibleHead,
					onClick: () => {
						setOpen((v) => !v);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.collapsibleChev,
							children: open ? "▾" : "▸"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.collapsibleLabel,
							children: t("contextTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.collapsibleAction,
							children: format(t("contextCount"), { n: contexts.defaultCount })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.collapsibleAction,
							children: open ? t("collapse") : t("expand")
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.inline,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: t("contextNote")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.inline,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: format(t("contextTableNote"), { path: contexts.tablePath || "—" })
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.note,
								children: t("contextDefaultItem")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								onClick: contexts.reload,
								children: t("refresh")
							})]
						}),
						contexts.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: contexts.message }) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.scanList,
							children: contexts.candidates.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.note,
								children: t("contextNoCandidates")
							}) : contexts.candidates.map((skill) => {
								const slug = skill.slug ?? "";
								const on = contexts.checked[slug] === true;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: settings_card_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.main,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: settings_card_module_css_default.name,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: settings_card_module_css_default.nameText,
												children: skill.name
											})
										}), skill.description.trim() === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: settings_card_module_css_default.desc,
											children: shortText(skill.description)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: on,
										disabled: contexts.busySlug === slug,
										onChange: () => {
											contexts.toggle(slug);
										},
										label: on ? t("injectOn") : t("injectOff")
									})]
								}, slug || skill.path);
							})
						})
					]
				}) : null]
			});
		}
		/** Pick-a-directory flow for registering external skills (copies stay put). */
		function RegisterSection({ skills, t }) {
			const scan = skills.scan;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.inline,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.hGrow,
						children: t("registerSkill")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						onClick: skills.refreshRegistry,
						disabled: skills.refreshing,
						children: t("refreshRegistry")
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.inline,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: settings_card_module_css_default.inputGrow,
							placeholder: t("phRegisterDir"),
							value: scan.dir,
							onChange: (e) => {
								skills.setScanDir(e.target.value);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							onClick: skills.chooseDir,
							children: t("chooseFolder")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: scan.busy,
							onClick: skills.doScan,
							children: scan.busy ? t("scanning") : t("scanDir")
						})
					]
				}),
				scan.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: scan.error }) : null,
				scan.items.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.scanList,
					children: [scan.items.map((it) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: settings_card_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							disabled: it.oversize,
							checked: !!scan.selected[it.sourcePath],
							onChange: () => {
								skills.toggleSelect(it.sourcePath);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.main,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.name,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: settings_card_module_css_default.nameText,
									children: [
										it.name,
										it.kind === "bundle" ? t("suffixDir") : t("suffixFile"),
										it.oversize ? t("suffixOversize") : ""
									]
								})
							}), it.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.desc,
								children: it.description
							}) : null]
						})]
					}, it.sourcePath)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						disabled: scan.busy,
						onClick: skills.doRegister,
						children: format(t("registerSelected"), { n: Object.keys(scan.selected).length })
					})]
				}) : null,
				scan.note ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.note,
					children: scan.note
				}) : null
			] });
		}
		/** Grouped list of every skill, with the shared loading / empty states. */
		function SkillList({ skills, t }) {
			if (skills.loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t });
			if (skills.groups.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: skills.query !== "" ? t("emptySkillMatch") : t("emptySkills") });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: skills.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.groupH,
				children: [
					group.label,
					" (",
					group.items.length,
					")"
				]
			}), group.items.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillRow, {
				skill,
				skills,
				t
			}, skill.path))] }, group.level)) });
		}
		/**
		* One row: the group badge and exactly the operations the row's group allows.
		* The source is not badged — every row in a group comes from the same place, so
		* the pill said the same thing twice; the path stays visible in 详情.
		*/
		function SkillRow({ skill, skills, t }) {
			const isBusy = skills.busyPath === skill.path;
			const isOpen = skills.detailPath === skill.path;
			const redFlag = skill.untracked === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.row,
				style: redFlag ? { outline: "1px solid var(--dsh-danger, #d1242f)" } : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.rowHead,
						style: { cursor: "pointer" },
						onClick: () => {
							skills.view(skill);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.name,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: settings_card_module_css_default.nameText,
								children: [skill.name, redFlag ? t("suffixUntracked") : ""]
							})
						}), skill.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.desc,
							children: skill.description
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: t(GROUP_KEY[skill.group]) }),
					redFlag ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						disabled: isBusy,
						onClick: () => {
							skills.verify(skill);
						},
						children: t("btnVerify")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						variant: "danger",
						disabled: isBusy,
						onClick: () => {
							skills.deleteUntracked(skill);
						},
						children: t("btnDeleteLink")
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						skill.group === "native" && skill.level === "user" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: isBusy,
							onClick: () => {
								skills.migrate(skill);
							},
							children: t("btnMigrate")
						}) : null,
						skill.group === "registered" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: isBusy,
							onClick: () => {
								skills.unregister(skill);
							},
							children: t("btnUnregister")
						}) : null,
						skill.group !== "native" ? skill.linked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "danger",
							disabled: isBusy,
							title: t("tipUnlink"),
							onClick: () => {
								skills.unlink(skill);
							},
							children: t("btnUnlink")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							variant: "success",
							disabled: isBusy,
							title: t("tipLink"),
							onClick: () => {
								skills.link(skill);
							},
							children: t("btnLink")
						}) : null
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						onClick: () => {
							skills.view(skill);
						},
						children: isOpen ? t("collapse") : t("details")
					}),
					skill.group === "stored" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmButton, {
						variant: "danger",
						label: t("delete"),
						confirmLabel: t("confirmDelete"),
						disabled: isBusy,
						onConfirm: () => {
							skills.remove(skill);
						}
					}) : null
				]
			}), isOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillDetail, {
				detail: skills.detail,
				path: skill.path,
				fallback: skill.description,
				t
			}) : null] });
		}
		/** Expanded SKILL.md preview for one row. */
		function SkillDetail({ detail, path, fallback, t }) {
			const d = detail && detail.path === path ? detail.data : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: d === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") }) : d && d.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: d.error }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.name,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.nameText,
							children: d.description || fallback
						})
					}),
					d.whenToUse ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.desc,
						children: [
							t("detailWhenToUse"),
							": ",
							d.whenToUse
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: settings_card_module_css_default.pre,
						children: d.content || ""
					})
				] })
			});
		}
		//#endregion
		//#region src/client/shared/constants.ts
		/** Fresh editor state — a new object per call so callers never share it. */
		function emptyMcpForm() {
			return {
				name: "",
				transport: "stdio",
				command: "",
				args: "",
				env: "",
				cwd: "",
				url: "",
				headers: "",
				mode: "form",
				json: ""
			};
		}
		/** The four management surfaces, in tab order. */
		const TABS = [
			"skills",
			"mcp",
			"cli",
			"guide"
		];
		/** Tab captions as locale keys (bilingual through the plugin's dictionary). */
		const TAB_LABELS = {
			skills: "tabSkills",
			mcp: "tabMcp",
			cli: "tabCli",
			guide: "tabGuide"
		};
		/** MCP server runtime status → locale key. */
		const MCP_STATUS_LABEL = {
			connecting: "stConnecting",
			running: "stRunning",
			failed: "stFailed",
			stopped: "stStopped"
		};
		/**
		* The two states of a local CLI's announcement switch.
		*
		* A CLI is installed and run by the system — this plugin can neither start nor
		* stop it. The switch therefore controls exactly one thing: whether the CLI is
		* listed in the announcement handed to every agent (公告), or left out of it
		* (隐藏). Distinct from the plugin's own 「向 AI 公告」 switch, which announces
		* the plugin's capabilities rather than one tool.
		*/
		const CLI_ANNOUNCE = {
			on: "cliAdvertised",
			off: "cliHidden"
		};
		/** Locale key for a CLI's announcement flag; absent or unrecognized → 隐藏. */
		function cliAnnounceLabel(advertised) {
			return advertised ? CLI_ANNOUNCE.on : CLI_ANNOUNCE.off;
		}
		/**
		* The two states of an MCP server's availability switch.
		*
		* Same vocabulary as {@link CLI_ANNOUNCE}: 激活 means the definition lives in
		* ~/.dsh/S-M-C/mcp.json and is really connected; 归档 means it was moved to
		* ~/.dsh/S-M-C/mcp-archive.json, so it is never connected and never announced.
		* The definition itself is preserved either way — archiving is not deleting.
		*/
		const MCP_ACTIVE = {
			active: "activate",
			archived: "archive"
		};
		/** Locale key for an MCP row's switch; a non-active row reads 归档. */
		function mcpActiveLabel(enabled) {
			return enabled ? MCP_ACTIVE.active : MCP_ACTIVE.archived;
		}
		//#endregion
		//#region src/client/features/mcp/McpPanel.tsx
		/**
		* MCP tab view, split into two sub-pages.
		*
		* 「管理」 is the list: one switch per row (激活 / 归档) plus delete — editing an
		* existing definition is deliberately not offered yet, so the row stays a
		* single decision. 「新建」 is the form / JSON editor that creates a definition.
		*
		* Presentation over {@link UseMcp}: the editor's mode toggle and the connect
		* test both live in the hook, so this file stays declarative.
		*/
		/** MCP tab. */
		function McpPanel({ mcp, t }) {
			const { form, patchForm } = mcp;
			const [sub, setSub] = (0, react.useState)("manage");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.tabs,
					role: "tablist",
					children: ["manage", "create"].map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": sub === id,
						className: sub === id ? settings_card_module_css_default.tabActive : settings_card_module_css_default.tab,
						onClick: () => {
							setSub(id);
						},
						children: t(id === "manage" ? "mcpTabManage" : "mcpTabCreate")
					}, id))
				}), sub === "manage" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: settings_card_module_css_default.hGrow,
									children: t("panelMcp")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: settings_card_module_css_default.inputGrow,
									placeholder: t("phSearchServer"),
									value: mcp.query,
									onChange: (e) => {
										mcp.setQuery(e.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									onClick: mcp.reload,
									disabled: mcp.refreshing,
									children: t("refresh")
								})
							]
						}),
						mcp.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: mcp.message }) : null,
						mcp.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: mcp.error }) : null,
						mcp.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t }) : mcp.servers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: mcp.total === 0 ? t("emptyMcp") : t("emptyMcpMatch") }) : mcp.servers.map((s) => {
							const statusKey = MCP_STATUS_LABEL[s.status];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.main,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: settings_card_module_css_default.name,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: settings_card_module_css_default.nameText,
														children: [s.name, s.archived ? t("suffixArchived") : ""]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: settings_card_module_css_default.status,
														children: s.archived ? t("stNotConnected") : statusKey ? t(statusKey) : s.status
													}),
													s.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: t("badgeArchive") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: t("badgeActive") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: settings_card_module_css_default.desc,
												children: [s.transport, s.transport === "stdio" ? " · " + (s.command || "") : " · " + (s.url || "")]
											}),
											s.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: s.error }) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: s.enabled,
										onChange: () => {
											mcp.toggle(s);
										},
										label: t(mcpActiveLabel(s.enabled))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmButton, {
										variant: "danger",
										label: t("delete"),
										confirmLabel: t("confirmDelete"),
										onConfirm: () => {
											mcp.remove(s);
										}
									})
								]
							}, s.name);
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.h,
							children: t("newServer")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: form.mode === "form" ? "active" : "default",
								onClick: () => {
									patchForm({ mode: "form" });
								},
								children: t("modeForm")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: form.mode === "json" ? "active" : "default",
								onClick: () => {
									patchForm({ mode: "json" });
								},
								children: t("modeJson")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.form,
							children: form.mode === "form" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldName"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: settings_card_module_css_default.input,
										value: form.name,
										placeholder: t("phServerName"),
										onChange: (e) => {
											patchForm({ name: e.target.value });
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldTransport"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: settings_card_module_css_default.input,
										value: form.transport,
										onChange: (e) => {
											patchForm({ transport: e.target.value });
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "stdio",
											children: "stdio"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "streamable-http",
											children: "streamable-http"
										})]
									})
								}),
								form.transport === "stdio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldCommand"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: settings_card_module_css_default.input,
											value: form.command,
											placeholder: "npx",
											onChange: (e) => {
												patchForm({ command: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldArgs"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: settings_card_module_css_default.input,
											rows: 2,
											value: form.args,
											placeholder: "-y\n@modelcontextprotocol/server-github",
											onChange: (e) => {
												patchForm({ args: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldEnv"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: settings_card_module_css_default.input,
											rows: 2,
											value: form.env,
											onChange: (e) => {
												patchForm({ env: e.target.value });
											}
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: t("fieldCwd"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: settings_card_module_css_default.input,
											value: form.cwd,
											onChange: (e) => {
												patchForm({ cwd: e.target.value });
											}
										})
									})
								] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldUrl"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: settings_card_module_css_default.input,
										value: form.url,
										placeholder: "http://localhost:3000/mcp",
										onChange: (e) => {
											patchForm({ url: e.target.value });
										}
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: t("fieldHeaders"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: settings_card_module_css_default.input,
										rows: 2,
										value: form.headers,
										onChange: (e) => {
											patchForm({ headers: e.target.value });
										}
									})
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: settings_card_module_css_default.inline,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										variant: "primary",
										disabled: mcp.busy === "save",
										onClick: () => {
											mcp.save();
											setSub("manage");
										},
										children: mcp.busy === "save" ? t("saving") : t("save")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										disabled: mcp.busy === "test",
										onClick: mcp.test,
										children: mcp.busy === "test" ? t("testing") : t("testConnect")
									})]
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: settings_card_module_css_default.inputMono,
								rows: 12,
								value: form.json,
								placeholder: "{\n  \"name\": \"github\",\n  \"transport\": \"stdio\",\n  \"command\": \"npx\",\n  \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"],\n  \"enabled\": true\n}",
								onChange: (e) => {
									patchForm({ json: e.target.value });
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "primary",
								disabled: mcp.busy === "save",
								onClick: () => {
									mcp.save();
									setSub("manage");
								},
								children: mcp.busy === "save" ? t("saving") : t("save")
							})] })
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/features/cli/CliPanel.tsx
		/**
		* CLI tab view. Presentation over {@link useCli}; the probe result pane is
		* folded in as a small local sub-component since it is only used here.
		*/
		/** CLI tab. */
		function CliPanel({ cli, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.inline,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: settings_card_module_css_default.hGrow,
									children: t("panelCli")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: settings_card_module_css_default.inputGrow,
									placeholder: t("phSearchCli"),
									value: cli.query,
									onChange: (e) => {
										cli.setQuery(e.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									onClick: cli.reload,
									disabled: cli.refreshing,
									children: t("refresh")
								})
							]
						}),
						cli.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: cli.message }) : null,
						cli.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: cli.error }) : null,
						cli.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { t }) : cli.entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: cli.total === 0 ? t("emptyCli") : t("emptyCliMatch") }) : cli.entries.map((entry) => {
							const isOpen = cli.detail !== null && cli.detail.name === entry.name;
							const isRegistry = entry.source === "registry";
							const isVirtual = entry.virtual === true;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.main,
										style: { cursor: "pointer" },
										onClick: () => {
											cli.view(entry.name);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: settings_card_module_css_default.name,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: settings_card_module_css_default.nameText,
												children: [isVirtual ? t("cliVirtualTitle") : entry.name, entry.enabled || isVirtual ? "" : t("suffixHidden")]
											}), isVirtual ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: settings_card_module_css_default.status,
												children: entry.exists ? t("stInstalled") : t("stNotFound")
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: settings_card_module_css_default.desc,
											children: isVirtual ? t("cliVirtualHint") : t(entry.source === "skill" ? "cliSkillSource" : "sourceSystem") + " · " + (entry.path || entry.command)
										})]
									}),
									isVirtual ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: entry.enabled,
										onChange: () => {
											cli.toggle(entry);
										},
										label: t(cliAnnounceLabel(entry.enabled))
									}),
									isVirtual ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										onClick: () => {
											cli.view(entry.name);
										},
										children: isOpen ? t("collapse") : t("probe")
									}),
									isRegistry ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmButton, {
										variant: "danger",
										label: t("delete"),
										confirmLabel: t("confirmDelete"),
										onConfirm: () => {
											cli.remove(entry);
										}
									}) : null
								]
							}), isOpen && cli.detail ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CliDetailPane, {
								detail: cli.detail,
								t
							}) : null] }, entry.name);
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.h,
						children: t("registerCli")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.inline,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: settings_card_module_css_default.inputGrow,
								placeholder: t("phCliName"),
								value: cli.form.name,
								onChange: (e) => {
									cli.setForm((prev) => ({
										...prev,
										name: e.target.value
									}));
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: settings_card_module_css_default.inputGrow,
								placeholder: t("phCliCall"),
								value: cli.form.command,
								onChange: (e) => {
									cli.setForm((prev) => ({
										...prev,
										command: e.target.value
									}));
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "primary",
								onClick: cli.addEntry,
								children: t("add")
							})
						]
					})]
				})]
			});
		}
		/** Expanded probe result for one CLI row, with the folded /help section. */
		function CliDetailPane({ detail, t }) {
			const [helpOpen, setHelpOpen] = (0, react.useState)(false);
			if (detail.busy) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("probing") })
			});
			if (detail.error) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: detail.error })
			});
			const { state, subcommands } = detail;
			const help = subcommands?.help ?? "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.detail,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowExists"),
						value: state?.exists === false ? t("stNotFound") : t("stInstalled")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowPath"),
						value: state?.path
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowVersion"),
						value: state?.version
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowNeedUpdate"),
						value: state?.needUpdate === true ? t("yesUpdateRecommended") : state?.needUpdate === false ? t("no") : void 0
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowApiKey"),
						value: state?.apiKey?.status ? state.apiKey.status === "configured" ? t("configured") : state.apiKey.status : void 0
					}),
					state?.apiKey?.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("rowKeyError"),
						value: state.apiKey.error
					}) : null,
					subcommands && subcommands.subcommands.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.inline,
						style: {
							flexWrap: "wrap",
							gap: 6
						},
						children: subcommands.subcommands.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, { children: c }, c))
					}) : null,
					help !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						onClick: () => {
							setHelpOpen((v) => !v);
						},
						children: helpOpen ? t("collapse") : t("helpToggle")
					}), helpOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: settings_card_module_css_default.pre,
						children: help
					}) : null] }) : null
				] })
			});
		}
		//#endregion
		//#region src/client/shared/api.ts
		/**
		* Browser-side client for the `/api/dsh-s-m-c-center` route family.
		*
		* The only data path the tabs use: plain `fetch`, same origin, JSON in and
		* out. Every call funnels through {@link call} so the two failure modes a
		* route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
		* — surface the same way, and a failure never arrives as a silent `undefined`.
		*/
		/** Raised for any route call that did not come back as `ok`. */
		var SkillsMcpApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "SkillsMcpApiError";
			}
		};
		/** Turn a response into its payload, or throw the reason it failed. */
		async function unwrap(response) {
			let body;
			try {
				body = await response.json();
			} catch {
				throw new SkillsMcpApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			if (response.ok) return body;
			const reported = body?.error;
			throw new SkillsMcpApiError(typeof reported === "string" ? reported : `HTTP ${response.status}`);
		}
		/**
		* One round trip.
		*
		* Routes split into reads (GET, no body) and actions (POST, JSON body); the
		* action routes that take no arguments still send `{}`, so the content-type
		* header always describes what actually went out.
		*/
		async function call(method, path, payload) {
			return unwrap(await fetch(path, payload === void 0 ? { method } : {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			}));
		}
		/** Append `?cwd=` when a workspace path is known (several routes are scoped). */
		function withCwd(path, cwd) {
			return cwd ? `${path}?cwd=${encodeURIComponent(cwd)}` : path;
		}
		/** `?name=…` plus an optional `&cwd=` for the CLI routes. */
		function withName(path, name, cwd) {
			return path + (`?name=${encodeURIComponent(name)}` + (cwd ? `&cwd=${encodeURIComponent(cwd)}` : ""));
		}
		/** The browser half's only data entry point. */
		var SkillsMcpApi = class {
			async listSkills(cwd) {
				return (await call("GET", withCwd(SMC_API.skills, cwd))).items;
			}
			async readSkill(path) {
				return (await call("POST", SMC_API.skillRead, { path })).skill;
			}
			/** Native → stored: canonical copy into the store, link back in place. */
			async migrateSkill(path, kind, source) {
				return (await call("POST", SMC_API.skillMigrate, {
					path,
					kind,
					source
				})).slug;
			}
			/** Create (or confirm) the `~/.dsh/skills/<slug>` link. */
			async linkSkill(slug) {
				await call("POST", SMC_API.skillLink, { slug });
			}
			/** Remove the link (the canonical copy is never touched). */
			async unlinkSkill(slug) {
				await call("POST", SMC_API.skillUnlink, { slug });
			}
			/** Verify one link (resolves? target alive? tracked?). */
			async verifyLink(slug) {
				return (await call("POST", SMC_API.skillVerify, { slug })).result;
			}
			/** Delete an untracked link (one the ledger has no record of). */
			async deleteUntrackedLink(path) {
				await call("POST", SMC_API.skillDeleteLink, { path });
			}
			/**
			* Delete one **stored** skill by slug. Only the store's canonical copies are
			* addressable this way — a native or registered skill is the user's (or
			* another tool's) file and is never removed by this plugin.
			*/
			async deleteSkill(slug) {
				await call("POST", SMC_API.skillDelete, { slug });
			}
			async scanSkills(dir) {
				return (await call("POST", SMC_API.skillScan, { dir })).items;
			}
			/** Register external skills — the canonical copy stays where it is. */
			async registerSkills(items) {
				return (await call("POST", SMC_API.skillRegister, { items })).results;
			}
			/** Drop a registry entry (and its link, when one exists). */
			async unregisterSkill(slug) {
				await call("POST", SMC_API.skillUnregister, { slug });
			}
			/** Traceability pass: does every registered path still exist? */
			async refreshRegistry() {
				return (await call("POST", SMC_API.skillRefresh, {})).results;
			}
			/** One conversation's selection: the effective set plus how it differs. */
			async getContext(sessionId) {
				return await call("POST", SMC_API.contextsGet, { sessionId });
			}
			/** Flip one slug in one conversation; applied live when it is running. */
			async toggleContext(sessionId, slug) {
				return await call("POST", SMC_API.contextsToggle, {
					sessionId,
					slug
				});
			}
			/**
			* Drop one conversation's own selection, so it follows the default again.
			* The escape hatch for a conversation that pinned a default it can no longer
			* turn off.
			*/
			async resetContext(sessionId) {
				return await call("POST", SMC_API.contextsReset, { sessionId });
			}
			async storeStatus() {
				return (await call("GET", SMC_API.skillStore)).store;
			}
			/** Undo the one-shot migration: every stored skill returns to its origin. */
			async rollbackStore() {
				return (await call("POST", SMC_API.skillRollback, {})).result;
			}
			/** Run the one-shot migration again — the undo for {@link rollbackStore}. */
			async reMigrateStore() {
				return (await call("POST", SMC_API.skillRemigrate, {})).result;
			}
			async listMcp() {
				return (await call("GET", SMC_API.mcp)).servers;
			}
			async saveMcp(server) {
				await call("POST", SMC_API.mcpSave, { server });
			}
			/** Activate (true) or archive (false) one definition. */
			async setMcpEnabled(name, enabled) {
				await call("POST", SMC_API.mcpEnabled, {
					name,
					enabled
				});
			}
			async deleteMcp(name) {
				await call("POST", SMC_API.mcpDelete, { name });
			}
			/** Restore the whole archive at once; returns how many came back. */
			async restoreAllMcp() {
				return (await call("POST", SMC_API.mcpRestoreAll, {})).restored;
			}
			async testMcp(server) {
				return (await call("POST", SMC_API.mcpTest, { server })).test;
			}
			async listCli(cwd) {
				return (await call("GET", withCwd(SMC_API.cli, cwd))).items;
			}
			async cliState(name, cwd) {
				return (await call("GET", withName(SMC_API.cliState, name, cwd))).state;
			}
			async cliSubcommands(name, cwd) {
				return (await call("GET", withName(SMC_API.cliSubcommands, name, cwd))).subcommands;
			}
			async saveCli(entry) {
				await call("POST", SMC_API.cliSave, { entry });
			}
			async setCliEnabled(name, enabled) {
				await call("POST", SMC_API.cliEnabled, {
					name,
					enabled
				});
			}
			async deleteCli(name) {
				await call("POST", SMC_API.cliDelete, { name });
			}
			/** Both probe halves in one round trip (state + subcommands). */
			async probeCli(name, cwd) {
				const body = await call("POST", SMC_API.cliProbe, {
					name,
					cwd
				});
				return {
					state: body.state,
					subcommands: body.subcommands
				};
			}
			async getSettings() {
				return (await call("GET", SMC_API.settings)).settings;
			}
			async saveSettings(settings) {
				return (await call("POST", SMC_API.settingsSave, { settings })).settings;
			}
		};
		//#endregion
		//#region src/client/shared/useApi.ts
		/**
		* The single owner of the HTTP client instance.
		*
		* Every data-access hook imports the client from here, so exactly one
		* SkillsMcpApi object exists per browser bundle (the old module created it in
		* the component file, which mixed transport concerns into the view layer).
		*/
		/** Stateless fetch client over the /api/dsh-s-m-c-center routes. */
		const api = new SkillsMcpApi();
		//#endregion
		//#region src/client/features/guide/GuidePanel.tsx
		/**
		* Guide tab. Two halves, in this order:
		*
		* 1. How the plugin works — one top-level heading per tool family (skills /
		*    MCP servers / local CLI tools) plus a "where the data lives" section, each
		*    explained by second-level topics. The copy that used to sit on the three
		*    management tabs lives here, so those tabs stay purely operational.
		* 2. Uninstall preparation — the escape hatch itself: give back skills ("撤销
		*    迁移" / "迁移"), inject every archived MCP server back, and list the files
		*    that must be removed by hand.
		*
		* The two heading levels are visually distinct on purpose (`.docH1` for the
		* families, `.groupH` for the topics inside them).
		*
		* Presentation over the skills/mcp hooks the shell already owns: this panel
		* triggers the shared API and asks the shell to bump its refresh counter, so
		* the other tabs stay in step without extra fetching.
		*/
		/** A second-level topic: heading plus its paragraph. */
		function Topic({ h, p }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.groupH,
				children: h
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: settings_card_module_css_default.descWrap,
				children: p
			})] });
		}
		/** Guide tab. */
		function GuidePanel({ skills, mcp, refresh, t }) {
			const [busy, setBusy] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const store = skills.store;
			const storeRoot = store?.root || "~/.dsh/S-M-C";
			const storeCount = store?.count ?? 0;
			const archivedCount = mcp.servers.filter((s) => s.archived).length;
			const canRollback = storeCount > 0;
			const canMigrate = storeCount === 0 && skills.userUnmanaged > 0;
			const canRestoreMcp = archivedCount > 0;
			const nothingToDo = !canRollback && !canMigrate && !canRestoreMcp;
			const run = (which, action) => {
				setBusy(which);
				setMessage("");
				action().catch((e) => {
					setMessage(errorText(e));
				}).finally(() => {
					setBusy("");
					refresh();
				});
			};
			const doRollback = () => run("rollback", async () => {
				const op = await api.rollbackStore();
				setMessage(op.failures.length === 0 ? format(t("msgRollbackOk"), { moved: op.moved }) : format(t("msgRollbackPartial"), {
					moved: op.moved,
					failed: op.failures.length
				}));
			});
			const doMigrate = () => run("migrate", async () => {
				const op = await api.reMigrateStore();
				setMessage(format(t("msgMigrateDone"), { moved: op.moved }));
			});
			const doRestore = () => run("restore", async () => {
				const restored = await api.restoreAllMcp();
				setMessage(format(t("msgRestoreDone"), { restored }));
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.hGrow,
							children: t("panelGuide")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("guideIntro")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideSkillsH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideStoreH"),
							p: t("guideStoreP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideEnableH"),
							p: t("guideEnableP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideSessionH"),
							p: t("guideSessionP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideMcpH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideConnectH"),
							p: t("guideConnectP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideArchiveH"),
							p: t("guideArchiveP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideCliH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideDiscoverH"),
							p: t("guideDiscoverP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Topic, {
							h: t("guideAnnounceH"),
							p: t("guideAnnounceP")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("guideDataH")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("guideDataP")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.docH1,
							children: t("panelUninstall")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallIntro")
						}),
						message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: message }) : null,
						nothingToDo ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, { title: t("uninstallNothing") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.groupH,
								children: t("uninstallSkillsTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: t("uninstallSkillsNote")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.inline,
								children: [canRollback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "danger",
									disabled: busy !== "",
									onClick: doRollback,
									children: busy === "rollback" ? t("rollingBack") : t("rollback")
								}) : null, canMigrate ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "success",
									disabled: busy !== "",
									onClick: doMigrate,
									children: busy === "migrate" ? t("migratingSkills") : t("migrateSkills")
								}) : null]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.groupH,
								children: t("uninstallMcpTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.descWrap,
								children: t("uninstallMcpNote")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.inline,
								children: canRestoreMcp ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
									variant: "primary",
									disabled: busy !== "",
									onClick: doRestore,
									children: busy === "restore" ? t("restoringMcp") : t("restoreAllMcp")
								}) : null
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.groupH,
							children: t("uninstallFilesTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallFilesNote")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.pathList,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.pathMain,
								children: [storeRoot, store === null ? "" : "/"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: settings_card_module_css_default.pathSub,
								children: t("uninstallFilesList")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_card_module_css_default.descWrap,
							children: t("uninstallSettingsPath")
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/shared/useAsyncList.ts
		/**
		* Generic "fetch a list on mount / on dependency change" hook.
		*
		* All three panels previously hand-rolled the same shape: a `{loading, items,
		* error}` record, a `load()` that resets it, and a useEffect keyed on the
		* current cwd plus a refresh counter. This factors that out once.
		*
		* Two loading notions are kept apart on purpose. A refetch that follows a local
		* action (toggling a switch, deleting a row) must not blank the panel: the list
		* stays on screen and is simply replaced once the fresh payload lands. Only the
		* very first fetch — where there is genuinely nothing to show — reports
		* `loading`, so the panels' loading placeholder never appears mid-session.
		*/
		/**
		* Fetch a list whenever a dependency changes (or `reload()` is called).
		*
		* @param fetcher - Returns the list. Must be stable or declared inline; it is
		*   read through a ref so an inline closure does not retrigger the effect.
		* @param deps - Values whose change should refetch (cwd, refresh counter, …).
		*/
		function useAsyncList(fetcher, deps) {
			const [state, setState] = (0, react.useState)({
				loading: true,
				refreshing: true,
				items: [],
				error: ""
			});
			const fetcherRef = (0, react.useRef)(fetcher);
			fetcherRef.current = fetcher;
			const run = (0, react.useCallback)(() => {
				setState((prev) => ({
					...prev,
					refreshing: true,
					error: ""
				}));
				fetcherRef.current().then((items) => {
					setState({
						loading: false,
						refreshing: false,
						items,
						error: ""
					});
				}).catch((e) => {
					setState((prev) => ({
						loading: false,
						refreshing: false,
						items: prev.items,
						error: errorText(e)
					}));
				});
			}, []);
			(0, react.useEffect)(() => {
				run();
			}, deps);
			const setItems = (0, react.useCallback)((next) => {
				setState((prev) => ({
					...prev,
					items: typeof next === "function" ? next(prev.items) : next
				}));
			}, []);
			return {
				...state,
				reload: run,
				setItems
			};
		}
		//#endregion
		//#region src/client/features/skills/useSkills.ts
		/**
		* Skills tab state: the four-group skill list, the detail pane, the
		* scan/register flow and the toolbar filters.
		*
		* The view layer receives ready-to-render values (`filtered`, `groups`) plus
		* the action callbacks; it never touches the API client or the raw fetch shape.
		*/
		/** Group captions as locale keys; the panel resolves them with `t`. */
		const GROUP_ORDER = [
			{
				level: "user",
				group: "native",
				label: "levelUser"
			},
			{
				level: "user",
				group: "stored",
				label: "levelStore"
			},
			{
				level: "user",
				group: "registered",
				label: "groupRegistered"
			},
			{
				level: "project",
				label: "levelProject"
			}
		];
		/** Skills tab controller. */
		function useSkills(options) {
			const { cwd, refreshKey, pickDirectory, t } = options;
			const list = useAsyncList(() => api.listSkills(cwd), [cwd, refreshKey]);
			const [query, setQuery] = (0, react.useState)("");
			const [busyPath, setBusyPath] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const [detailPath, setDetailPath] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [store, setStore] = (0, react.useState)(null);
			const [scan, setScan] = (0, react.useState)({
				dir: "",
				busy: false,
				items: [],
				selected: {},
				error: "",
				note: ""
			});
			const reloadStore = (0, react.useCallback)(() => {
				api.storeStatus().then(setStore).catch(() => {
					setStore(null);
				});
			}, []);
			const reloadList = list.reload;
			const reloadAll = (0, react.useCallback)(() => {
				reloadList();
				reloadStore();
			}, [reloadList, reloadStore]);
			(0, react.useEffect)(() => {
				reloadStore();
			}, [refreshKey, reloadStore]);
			/** Run one mutation against the API, then refresh list + banner. */
			const act = (0, react.useCallback)((skill, run, done) => {
				setBusyPath(skill.path);
				setMessage("");
				run().then((result) => {
					setBusyPath("");
					const note = done?.(result);
					if (typeof note === "string") setMessage(note);
					reloadAll();
				}).catch((e) => {
					setBusyPath("");
					setMessage(errorText(e));
				});
			}, [reloadAll]);
			const link = (0, react.useCallback)((skill) => {
				act(skill, () => api.linkSkill(skill.slug ?? ""));
			}, [act]);
			const unlink = (0, react.useCallback)((skill) => {
				act(skill, () => api.unlinkSkill(skill.slug ?? ""));
			}, [act]);
			const migrate = (0, react.useCallback)((skill) => {
				act(skill, () => api.migrateSkill(skill.path, skill.kind, skill.source));
			}, [act]);
			const unregister = (0, react.useCallback)((skill) => {
				act(skill, () => api.unregisterSkill(skill.slug ?? ""));
			}, [act]);
			const verify = (0, react.useCallback)((skill) => {
				const key = skill.slug ?? skill.path;
				act(skill, () => api.verifyLink(key), (result) => {
					const v = result;
					if (!v.ok) return errorText(v.reason ?? "verify failed");
					return v.tracked ? t("msgVerifyTracked") + (v.target ?? "") : t("msgVerifyUntracked") + (v.target ?? "");
				});
			}, [act, t]);
			const deleteUntracked = (0, react.useCallback)((skill) => {
				act(skill, () => api.deleteUntrackedLink(skill.path));
			}, [act]);
			const refreshRegistry = (0, react.useCallback)(() => {
				setMessage("");
				api.refreshRegistry().then((results) => {
					const missing = results.filter((r) => !r.exists);
					setMessage(missing.length === 0 ? format(t("msgRefreshOk"), { n: results.length }) : format(t("msgRefreshMissing"), { n: missing.length }) + " " + missing.map((m) => m.name).join(", "));
					reloadAll();
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [reloadAll, t]);
			const remove = (0, react.useCallback)((skill) => {
				act(skill, () => api.deleteSkill(skill.slug ?? ""));
			}, [act]);
			const view = (0, react.useCallback)((skill) => {
				if (detailPath === skill.path) {
					setDetailPath(null);
					setDetail(null);
					return;
				}
				setDetailPath(skill.path);
				setDetail(null);
				api.readSkill(skill.path).then((data) => {
					setDetail({
						path: skill.path,
						data
					});
				}).catch((e) => {
					setDetail({
						path: skill.path,
						data: { error: errorText(e) }
					});
				});
			}, [detailPath]);
			const setScanDir = (0, react.useCallback)((dir) => {
				setScan((prev) => ({
					...prev,
					dir,
					error: ""
				}));
			}, []);
			const chooseDir = (0, react.useCallback)(() => {
				pickDirectory().then((path) => {
					if (path) setScan((prev) => ({
						...prev,
						dir: path,
						error: ""
					}));
				}).catch((e) => {
					setScan((prev) => ({
						...prev,
						error: errorText(e)
					}));
				});
			}, [pickDirectory]);
			const doScan = (0, react.useCallback)(() => {
				setScan((prev) => {
					const dir = prev.dir.trim();
					if (!dir) return {
						...prev,
						error: t("msgEnterDir")
					};
					api.scanSkills(dir).then((items) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							items,
							selected: {},
							note: items.length === 0 ? t("msgNoImportable") : ""
						}));
					}).catch((e) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							items: [],
							error: errorText(e)
						}));
					});
					return {
						...prev,
						busy: true,
						items: [],
						error: "",
						note: ""
					};
				});
			}, [t]);
			const toggleSelect = (0, react.useCallback)((sourcePath) => {
				setScan((prev) => {
					const selected = { ...prev.selected };
					if (selected[sourcePath]) delete selected[sourcePath];
					else selected[sourcePath] = true;
					return {
						...prev,
						selected
					};
				});
			}, []);
			const doRegister = (0, react.useCallback)(() => {
				setScan((prev) => {
					const chosen = prev.items.filter((it) => prev.selected[it.sourcePath] && !it.oversize);
					if (chosen.length === 0) return {
						...prev,
						error: t("msgSelectFirst")
					};
					api.registerSkills(chosen.map((it) => ({
						sourcePath: it.sourcePath,
						kind: it.kind
					}))).then((results) => {
						const registered = results.filter((x) => x.ok).length;
						setScan((cur) => ({
							...cur,
							busy: false,
							selected: {},
							note: format(t("msgRegistered"), { n: registered })
						}));
						reloadAll();
					}).catch((e) => {
						setScan((cur) => ({
							...cur,
							busy: false,
							error: errorText(e)
						}));
					});
					return {
						...prev,
						busy: true,
						error: ""
					};
				});
			}, [reloadAll, t]);
			const filtered = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((it) => q === "" || it.name.toLowerCase().includes(q));
			}, [list.items, query]);
			const groups = (0, react.useMemo)(() => {
				return GROUP_ORDER.map(({ level, group, label }) => ({
					level,
					label: t(label),
					items: filtered.filter((it) => it.level === level && (group === void 0 || it.group === group))
				})).filter((g) => g.items.length > 0);
			}, [filtered, t]);
			const userUnmanaged = (0, react.useMemo)(() => list.items.filter((it) => it.level === "user" && it.group === "native").length, [list.items]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				filtered,
				groups,
				total: list.items.length,
				userUnmanaged,
				reload: reloadAll,
				query,
				setQuery,
				busyPath,
				message,
				link,
				unlink,
				migrate,
				unregister,
				verify,
				deleteUntracked,
				refreshRegistry,
				remove,
				detailPath,
				detail,
				view,
				store,
				scan,
				setScanDir,
				chooseDir,
				doScan,
				toggleSelect,
				doRegister
			};
		}
		//#endregion
		//#region src/client/features/skills/useContexts.ts
		/**
		* Conversation-context state for the session default: the skills every
		* conversation without a row of its own inherits.
		*
		* All of it lives in **one relay table on the host** (`$STORE_ROOT/
		* contexts.json`, keyed by session id), which is why this hook takes no cwd:
		* the settings page and the sidebar read the same document, so one switch can
		* no longer show two answers. The panel exposes the default alone — a
		* conversation's own selection is the agent's business.
		*/
		/** Session id the session default lives under (host mirror). */
		const DEFAULT_CONTEXT_ID = "_default";
		function useContexts(options) {
			const { refreshKey, skills, t } = options;
			const [checked, setChecked] = (0, react.useState)({});
			const [defaultCount, setDefaultCount] = (0, react.useState)(0);
			const [busySlug, setBusySlug] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const [tablePath, setTablePath] = (0, react.useState)("");
			const adopt = (0, react.useCallback)((selected, table) => {
				const next = {};
				for (const slug of selected) next[slug] = true;
				setChecked(next);
				setDefaultCount(selected.length);
				setTablePath(table);
			}, []);
			const reload = (0, react.useCallback)(() => {
				api.getContext(DEFAULT_CONTEXT_ID).then((body) => {
					adopt(body.selection.selected, body.table);
				}).catch(() => {
					setChecked({});
					setDefaultCount(0);
				});
			}, [adopt]);
			(0, react.useEffect)(() => {
				reload();
			}, [refreshKey, reload]);
			const toggle = (0, react.useCallback)((slug) => {
				setBusySlug(slug);
				setMessage("");
				api.toggleContext(DEFAULT_CONTEXT_ID, slug).then((body) => {
					adopt(body.selection.selected, body.table);
					setBusySlug("");
					setMessage(format(t("msgContextApplied"), {
						n: body.selection.selected.length,
						state: body.applied ? t("msgContextLive") : t("msgContextSaved")
					}));
				}).catch((e) => {
					setBusySlug("");
					setMessage(errorText(e));
				});
			}, [adopt, t]);
			return {
				checked,
				defaultCount,
				candidates: (0, react.useMemo)(() => skills.filter((s) => s.level === "user" && s.linked && typeof s.slug === "string" && s.slug !== ""), [skills]),
				busySlug,
				message,
				tablePath,
				reload,
				toggle
			};
		}
		//#endregion
		//#region src/client/features/mcp/useMcp.ts
		/**
		* MCP tab state: the server list, the create/edit editor (form + JSON modes)
		* and the connect-test action.
		*/
		/** MCP tab controller. */
		function useMcp(options) {
			const { refreshKey, t } = options;
			const list = useAsyncList(() => api.listMcp(), [refreshKey]);
			const [form, setForm] = (0, react.useState)(emptyMcpForm);
			const [busy, setBusy] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)("");
			const [query, setQuery] = (0, react.useState)("");
			const patchForm = (0, react.useCallback)((p) => {
				setForm((prev) => ({
					...prev,
					...p
				}));
			}, []);
			const buildServer = (0, react.useCallback)(() => {
				if (form.mode === "json") try {
					return JSON.parse(form.json);
				} catch (e) {
					setMessage(format(t("msgJsonFailed"), { error: errorText(e) }));
					return null;
				}
				const server = {
					name: form.name.trim(),
					transport: form.transport,
					enabled: true
				};
				if (form.transport === "stdio") {
					server.command = form.command.trim();
					server.args = form.args.split(/\n/).map((l) => l.trim()).filter((l) => l !== "");
					server.cwd = form.cwd.trim();
					server.env = parseKv(form.env);
				} else {
					server.url = form.url.trim();
					server.headers = parseKv(form.headers);
				}
				return server;
			}, [form, t]);
			const save = (0, react.useCallback)(() => {
				const server = buildServer();
				if (!server) return;
				setBusy("save");
				setMessage("");
				api.saveMcp(server).then(() => {
					setBusy("");
					setMessage(format(t("msgSaved"), { name: server.name }));
					setForm(emptyMcpForm());
					list.reload();
				}).catch((e) => {
					setBusy("");
					setMessage(errorText(e));
				});
			}, [
				buildServer,
				list,
				t
			]);
			const test = (0, react.useCallback)(() => {
				const server = buildServer();
				if (!server) return;
				setBusy("test");
				setMessage("");
				api.testMcp(server).then((r) => {
					setBusy("");
					setMessage(r.ok ? t("msgConnectOk") : format(t("msgConnectFailed"), { error: r.error || "unknown error" }));
				}).catch((e) => {
					setBusy("");
					setMessage(errorText(e));
				});
			}, [buildServer, t]);
			const toggle = (0, react.useCallback)((s) => {
				const next = !s.enabled;
				setMessage("");
				const flip = (enabled) => (items) => items.map((it) => it.name === s.name ? {
					...it,
					enabled
				} : it);
				list.setItems(flip(next));
				api.setMcpEnabled(s.name, next).then(() => {
					setMessage(format(next ? t("msgActivated") : t("msgArchived"), { name: s.name }));
					list.reload();
				}).catch((e) => {
					list.setItems(flip(s.enabled));
					setMessage(errorText(e));
				});
			}, [list, t]);
			const remove = (0, react.useCallback)((s) => {
				setMessage("");
				api.deleteMcp(s.name).then(() => {
					list.reload();
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [list]);
			const edit = (0, react.useCallback)((s) => {
				setForm({
					name: s.name,
					transport: s.transport || "stdio",
					command: s.command || "",
					args: (s.args || []).join("\n"),
					env: kvText(s.env),
					cwd: s.cwd || "",
					url: s.url || "",
					headers: kvText(s.headers),
					mode: "form",
					json: JSON.stringify(s, null, 2)
				});
			}, []);
			const servers = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((s) => q === "" || s.name.toLowerCase().includes(q));
			}, [list.items, query]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				servers,
				total: list.items.length,
				reload: list.reload,
				query,
				setQuery,
				message,
				form,
				patchForm,
				busy,
				save,
				test,
				toggle,
				remove,
				edit
			};
		}
		//#endregion
		//#region src/client/features/cli/useCli.ts
		/**
		* CLI tab state: the discovered/registered CLI list, the on-demand probe
		* (existence / version / subcommands) and the registry add/remove flow.
		*/
		/** CLI tab controller. */
		function useCli(options) {
			const { cwd, refreshKey, t } = options;
			const list = useAsyncList(() => api.listCli(cwd), [cwd, refreshKey]);
			const [form, setForm] = (0, react.useState)({
				name: "",
				command: ""
			});
			const [detail, setDetail] = (0, react.useState)(null);
			const [message, setMessage] = (0, react.useState)("");
			const [query, setQuery] = (0, react.useState)("");
			const probe = (0, react.useCallback)((name) => {
				setDetail((prev) => ({
					name,
					busy: true,
					error: "",
					...prev && prev.name === name ? prev : {}
				}));
				api.probeCli(name, cwd).then((r) => {
					setDetail({
						name,
						state: r.state,
						subcommands: r.subcommands,
						busy: false,
						error: ""
					});
				}).catch((e) => {
					setDetail({
						name,
						busy: false,
						error: errorText(e)
					});
				});
			}, [cwd]);
			const view = (0, react.useCallback)((name) => {
				if (detail && detail.name === name) {
					setDetail(null);
					return;
				}
				probe(name);
			}, [detail, probe]);
			const toggle = (0, react.useCallback)((entry) => {
				setMessage("");
				const flip = (enabled) => (items) => items.map((it) => it.name === entry.name ? {
					...it,
					enabled
				} : it);
				list.setItems(flip(!entry.enabled));
				api.setCliEnabled(entry.name, !entry.enabled).then(() => {
					list.reload();
				}).catch((e) => {
					list.setItems(flip(entry.enabled));
					setMessage(errorText(e));
				});
			}, [list]);
			const remove = (0, react.useCallback)((entry) => {
				if (entry.source !== "registry") return;
				setMessage("");
				api.deleteCli(entry.name).then(() => {
					list.reload();
					setDetail(null);
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [list]);
			const addEntry = (0, react.useCallback)(() => {
				const name = form.name.trim();
				const command = form.command.trim() || name;
				if (!name) {
					setMessage(t("msgEnterCliName"));
					return;
				}
				setMessage("");
				api.saveCli({
					name,
					command,
					enabled: true
				}).then(() => {
					setForm({
						name: "",
						command: ""
					});
					list.reload();
				}).catch((e) => {
					setMessage(errorText(e));
				});
			}, [
				form,
				list,
				t
			]);
			const entries = (0, react.useMemo)(() => {
				const q = normalizeQuery(query);
				return list.items.filter((it) => q === "" || it.name.toLowerCase().includes(q) || (it.skill || "").toLowerCase().includes(q));
			}, [list.items, query]);
			return {
				loading: list.loading,
				refreshing: list.refreshing,
				error: list.error,
				entries,
				total: list.items.length,
				reload: list.reload,
				query,
				setQuery,
				message,
				detail,
				view,
				toggle,
				remove,
				form,
				setForm,
				addEntry
			};
		}
		//#endregion
		//#region src/client/shared/useManagerSettings.ts
		/**
		* Own-settings state: this plugin's `dsh-s-m-c-center` namespace block in
		* ~/.dsh/settings.yaml.
		*
		* The write path is optimistic-free on purpose: the Host round-trips the
		* persisted record, and the Host side re-applies the system-prompt
		* announcement synchronously, so the returned value is the new truth.
		*/
		/** Read + persist the plugin's own settings block. */
		function useManagerSettings() {
			const [state, setState] = (0, react.useState)({
				loading: true,
				value: null,
				error: "",
				saving: false
			});
			(0, react.useEffect)(() => {
				let alive = true;
				api.getSettings().then((value) => {
					if (alive) setState((prev) => ({
						...prev,
						loading: false,
						value
					}));
				}).catch((e) => {
					if (alive) setState((prev) => ({
						...prev,
						loading: false,
						error: errorText(e)
					}));
				});
				return () => {
					alive = false;
				};
			}, []);
			const { value, saving } = state;
			const toggleAnnounce = (0, react.useCallback)(() => {
				if (!value || saving) return;
				setState((prev) => ({
					...prev,
					saving: true,
					error: ""
				}));
				api.saveSettings({ announceToAgent: !value.announceToAgent }).then((next) => {
					setState({
						loading: false,
						value: next,
						error: "",
						saving: false
					});
				}).catch((e) => {
					setState((prev) => ({
						...prev,
						saving: false,
						error: errorText(e)
					}));
				});
			}, [value, saving]);
			return {
				...state,
				toggleAnnounce
			};
		}
		//#endregion
		//#region src/client/shell/ManagerShell.tsx
		/**
		* Top-level manager shell: the announce-to-agent switch, the tab bar and the
		* active panel.
		*
		* The shell owns only navigation state (active tab, cross-tab refresh counter).
		* All data state lives in the per-tab hooks, so switching tabs is cheap and the
		* panels stay independent.
		*/
		/** Skills / MCP / CLI manager root. */
		function ManagerShell({ cwd, enabled, pickDirectory, t }) {
			const [tab, setTab] = (0, react.useState)("skills");
			const [refreshKey, setRefreshKey] = (0, react.useState)(0);
			const bump = (0, react.useCallback)(() => {
				setRefreshKey((k) => k + 1);
			}, []);
			const settings = useManagerSettings();
			const skills = useSkills({
				cwd,
				refreshKey,
				pickDirectory,
				t
			});
			const contexts = useContexts({
				refreshKey,
				skills: skills.filtered,
				t
			});
			const mcp = useMcp({
				refreshKey,
				t
			});
			const cli = useCli({
				cwd,
				refreshKey,
				t
			});
			const announceOn = settings.value?.announceToAgent ?? false;
			const announceUnavailable = settings.loading || settings.saving || settings.value === null;
			const [notesOpen, setNotesOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.manager,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.section,
						style: { marginBottom: 12 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.inline,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: settings_card_module_css_default.hGrow,
										children: t("announceTitle")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
										onClick: () => {
											setNotesOpen((v) => !v);
										},
										children: notesOpen ? t("collapse") : t("expand")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
										checked: announceOn,
										disabled: announceUnavailable,
										onChange: settings.toggleAnnounce,
										label: settings.loading ? t("announceReading") : announceOn ? t("announceOnState") : t("announceOffState")
									})
								]
							}),
							notesOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: settings_card_module_css_default.noteLines,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("announceOnNote") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("announceOffNote") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: settings_card_module_css_default.noteFoot,
										children: [
											t("persistA"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "dsh-s-m-c-center" }),
											" ",
											t("persistB"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "~/.dsh/settings.yaml" }),
											t("persistC")
										]
									})
								]
							}) : null,
							settings.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorText, { children: settings.error }) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: settings_card_module_css_default.tabs,
						role: "tablist",
						children: TABS.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === id,
							className: tab === id ? settings_card_module_css_default.tabActive : settings_card_module_css_default.tab,
							onClick: () => {
								setTab(id);
							},
							children: t(TAB_LABELS[id])
						}, id))
					}),
					enabled ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.disabledBanner,
						role: "status",
						children: t("pluginDisabled")
					}),
					tab === "skills" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsPanel, {
						skills,
						contexts,
						t
					}) : null,
					tab === "mcp" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(McpPanel, {
						mcp,
						t
					}) : null,
					tab === "cli" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CliPanel, {
						cli,
						t
					}) : null,
					tab === "guide" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GuidePanel, {
						skills,
						mcp,
						refresh: bump,
						t
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/shell/SettingsCard.tsx
		/**
		* Render the settings section content.
		* @param props - locale copy, the global useWorkspaces hook, and the picker helper.
		* @returns the section page.
		*/
		function SkillsMcpSection(props) {
			const { t } = props;
			const cwd = props.useWorkspaces((s) => s.items[0]?.path ?? "");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.sectionPage,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: settings_card_module_css_default.pageHeading,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.pageIntro,
						children: t("description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagerShell, {
						cwd,
						enabled: true,
						pickDirectory: props.pickDirectory,
						t
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "dsh-s-m-c-center";
		/** Required services (fiber inject waiting — the runtime must be up first).
		* `settings.section` itself is declared by the settings shell, so mounting
		* only waits on the services this page actually reads. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.directoryPicker"
		];
		/**
		* Mount the settings page.
		* @param ctx - client root context (slots, locale, remote).
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-s-m-c-center: dictionaries");
			mountSidebarEntry(ctx);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skills-mcp",
				order: 20,
				label: () => ctx.locale.bind(NS)("title"),
				locale: NS,
				inject: () => ({ pickDirectory: async () => {
					const result = await ctx.remote.directoryPicker.pick();
					if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`);
					return result.value;
				} })
			}, SkillsMcpSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map