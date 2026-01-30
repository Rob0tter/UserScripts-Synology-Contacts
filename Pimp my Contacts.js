// ==UserScript==
// @name         Pimp my Contacts
// @namespace    https://github.com/Rob0tter/UserScripts-Synology-Contacts
// @version      1.0
// @date         2026-01-30
// @description  Order by last name, use german date format, add context menu for contact details and much more
// @author       Dirk Schwarzmann
// @match        add-your-calendar-url-here
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
	"use strict";

	// =============================================================
	// User configuration area - feel free!
	// =============================================================

	const CONFIG = {
		doLog: true,
		locale: "en",
		germanDate: false,
		sortByLastName: true,
		contextMenu: true,
		capitalizeUserTypes: true
	}

	// =============================================================
	// User configuration area ends here - no more user changes!
	// =============================================================

	log("Pimp my Synology Contacts: UserScript starting");
	log("Language is '" + CONFIG.locale + "'");
	log("Convert date to german format: " + CONFIG.germanDate);
	log("Sort contacts by last name: " + CONFIG.sortByLastname);
	log("Display additional context menu: " + CONFIG.contextMenu);
	log("Capitalize user-defined item types: " + CONFIG.capitalizeUserTypes);

	// ==================== LANGUAGE STRINGS ====================

	const l10n = {
		en: {
			saveButtonLabel:    "save",
			actLbl_sendMail:    "Send Mail",
			actLbl_clipCopy:    "Copy",
			actLbl_openUrl:     "Open Website",
			actLbl_callPhone:   "Call Phone",
			actLbl_openChat:    "Chat",
			actLbl_openCal:     "Add to Calendar",
			actLbl_openAddress: "Open Address"
		},
		de: {
			saveButtonLabel: "speichern",
			actLbl_sendMail:    "Sende Mail",
			actLbl_clipCopy:    "Kopieren",
			actLbl_openUrl:     "Öffne Webseite",
			actLbl_callPhone:   "Anrufen",
			actLbl_openChat:    "Chatten",
			actLbl_openCal:     "Termin in Kalender",
			actLbl_openAddress: "Öffne Adresse"
		}
	}

	function t(key) {
		return l10n[CONFIG.locale]?.[key] || l10n["en"][key] || key;
	}

	// ==================== ARRAY.SORT OVERRIDE ====================

	const originalSort = Array.prototype.sort;

	Array.prototype.sort = function(...args) {
		if (this.length > 0 && this[0]?.full_name) {
			return originalSort.call(this, sortByLastName);
		}

		return originalSort.call(this, ...args);
	};

	// ==================== HELPER FUNCTIONS ====================

	// log to console with some extra info
	function log(dataStr) {
		if (CONFIG.doLog) {
			console.log(new Date().toISOString(), " ", dataStr);
		}
	}

	function parseFullName(fullName) {
		if (!fullName) return {lastName: "", firstName: ""};

		const parts = fullName.trim().split(/\s+/);

		if (parts.length > 1) {
			return {
				lastName: parts[parts.length - 1],
				firstName: parts.slice(0, -1).join(" ")
			};
		} else {
			return {
				lastName: parts[0] || "",
				firstName: ""
			};
		}
	}

	function convertDateToGerman(dateStr) {
		if (!dateStr) return dateStr;

		const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

		if (match) {
			const [, year, month, day] = match;

			return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
		}

		return dateStr;
	}

	function convertDateToISO(dateStr) {
		if (!dateStr) return dateStr;

		const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

		if (match) {
			const [, day, month, year] = match;

			return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
		}

		return dateStr;
	}

	function isDateGerman(dateStr) {
		return dateStr && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr);
	}

	function sortByLastName(a, b) {
		const nameA = a.full_name || "";
		const nameB = b.full_name || "";
		const parsedA = parseFullName(nameA);
		const parsedB = parseFullName(nameB);

		const cmp = parsedA.lastName.localeCompare(parsedB.lastName, CONFIG.locale);

		return cmp !== 0 ? cmp : parsedA.firstName.localeCompare(parsedB.firstName, CONFIG.locale);
	}

	function capitalizeWords(str) {
		if (!str) return str;

		return str.toLowerCase().replace(/(^|[^a-z])([a-z])/g, function(match, separator, letter) {
			return separator + letter.toUpperCase();
		});
	}

	function copyToClipboard(text) {
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(text).then(() => {
				log("Copied (modern handler): " + text);
			});
		} else {
			// Fallback for ancient browsers
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
				log("Copied (fallback handler): " + text);
		}
	}

	// ==================== REACT PROPS TRANSFORMATION ====================

	// Process the contact list: order names, format dates
	function transformContactList() {
		const grid = document.querySelector(".ReactVirtualized__Grid");

		if (!grid) return false;

		const reactKey = Object.keys(grid).find(k => k.startsWith("__reactInternal"));

		if (!reactKey) return false;

		let fiber = grid[reactKey];
		let depth = 0;

		while (fiber && depth < 15) {
			if (fiber.memoizedProps?.list && Array.isArray(fiber.memoizedProps.list)) {
				const list = fiber.memoizedProps.list;

				// Check if contact list is already re-ordered, so we can leave the func immediately
				const alreadySorted = list[0]?.full_name?.includes(',');
				const alreadyFormatted = list[0]?.birthday && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(list[0].birthday);

				// Skip processing if nothing to do
				if ((!CONFIG.sortByLastname || alreadySorted) && (!CONFIG.germanDate || alreadyFormatted)) {
					return true;
				}
				
				log("Transform the contact list: start");

				// Step 1: Sort if enabled
				let processed = [...list];
				if (CONFIG.sortByLastname && !alreadySorted) {
					processed = processed.sort(sortByLastName);
					log('Contacts ordered by last name');
				}
				
				// Step 2: Transform contacts
				const transformed = processed.map(contact => {
					const result = { ...contact };
					
					// Format name if sorting is enabled
					if (CONFIG.sortByLastname && !alreadySorted) {
						if (result.full_name) {
							const p = parseFullName(result.full_name);
							result.full_name = p.firstName && p.lastName ? `${p.lastName}, ${p.firstName}` : result.full_name;
						}
					}
					
					// Format dates if enabled
					if (CONFIG.germanDate && !alreadyFormatted) {
						result.birthday = convertDateToGerman(result.birthday);
						result.date = convertDateToGerman(result.date);
					}
					
					return result;
				});

				// Update React props
				fiber.memoizedProps.list = transformed;
				
				// Force update
				let comp = fiber;
				
				while (comp) {
					if (comp.stateNode?.forceUpdate) {
						comp.stateNode.forceUpdate();
						break;
					}
					comp = comp.return;
				}
				
				if (CONFIG.germanDate && !alreadyFormatted) {
					log('Dates formatted to German');
				}
				
				log(transformed.length + ' contacts transformed');
				
				return true;
			}
			
			fiber = fiber.return;
			depth++;
		}
		
		return false;
	}

	// ==================== EDIT MODE FUNCTIONS ====================

	const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
	let isInEditMode = false;
	let monitorInterval = null;

	// We need to know if a contact is currently in editing mode because we need to monitor date editing
	function onEditModeChange() {
		// Nothing to do if dates shall not be formatted
		if (!CONFIG.germanDate) return true;
		
		const saveBtn = Array.from(document.querySelectorAll("button")).find(b =>
			b.textContent.toLowerCase().includes(t("saveButtonLabel"))
		);

		const wasInEdit = isInEditMode;
		isInEditMode = !!saveBtn;

		if (isInEditMode && !wasInEdit) {
			log("Edit Mode: START");
			startDateMonitoring();
			setupSaveButton(saveBtn);
		} else if (!isInEditMode && wasInEdit) {
			log("Edit Mode: END");
			stopDateMonitoring();
			setTimeout(() => {
				document.querySelectorAll("[data-date-processed]").forEach(el => delete el.dataset.dateProcessed);
				formatContactCard();
			}, 500);
		}
	}

	// Monitor and intercept on date input fields for german format
	function startDateMonitoring() {
		monitorInterval = setInterval(() => {
			document.querySelectorAll("input[class*='EditableTextField__Input__']").forEach(input => {
				if (input.value && /^\d{4}-\d{1,2}-\d{1,2}$/.test(input.value)) {
					const germanDate = convertDateToGerman(input.value);
					nativeValueSetter.call(input, germanDate);
					input.dispatchEvent(new Event("input", { bubbles: true }));
				}
			});
		}, 100);
	}

	function stopDateMonitoring() {
		if (monitorInterval) {
			clearInterval(monitorInterval);
			monitorInterval = null;
		}
	}

	function setupSaveButton(btn) {
		if (btn.dataset.saveSetup) return;

		btn.dataset.saveSetup = "true";

		// Dates must be converted back to ISO before saving, otherwise Synology will discard the input
		btn.addEventListener("click", function() {
			document.querySelectorAll("input[class*='EditableTextField__Input__']").forEach(input => {
				if (input.value && isDateGerman(input.value)) {
					nativeValueSetter.call(input, convertDateToISO(input.value));
					input.dispatchEvent(new Event("input", { bubbles: true }));
				}
			});
		}, { capture: true });
	}

	// ==================== VIEW MODE FUNCTIONS ====================

	// Configuration: which actions are available for which type of data
	// Format: "FieldType": [action1, action2, ...] - first item is default action
	const fieldActions = {
		"Email": [
			{ label: t("actLbl_sendMail"), action: handleEmail },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Tel": [
			//{ label: t("actLbl_callPhone"), action: handlePhoneNumber },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Url": [
			{ label: t("actLbl_openUrl"), action: handleWebUrl },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Birthday": [
			//{ label: t("actLbl_openCal"), action: handleCalendar },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Date": [
			//{ label: t("actLbl_openCal"), action: handleCalendar },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Address": [
			//{ label: t("actLbl_openAddress"), action: handleAddress },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Im": [
			//{ label: t("actLbl_openChat"), action: handleMessenger },
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		],
		"Note": [
			{ label: t("actLbl_clipCopy"), action: handleCopy2Clip }
		]
	};

	// Here is where the contact details are reformatted (view mode)
	function formatContactCard() {
		document.querySelectorAll("[class*='ContactDetail__ContentElement__'], [class*='ContactDetail__NoteElement__']").forEach(container => {
			const valueElem = container.querySelector("[class*='ContactDetail__Value__']") || container.querySelector("[class*='ContactDetail__NoteValue__']");

			if (!valueElem) return;

			// Find the type of data field (mail, phone, address, ...)
			const fieldType = detectFieldType(container, valueElem);

			// German date formatting; independent of defining context menu per field type
			if (CONFIG.germanDate) {
				if ((fieldType === "Birthday" || fieldType === "Date") &&
					!valueElem.dataset.dateProcessed &&
					/^\d{4}-\d{1,2}-\d{1,2}$/.test(valueElem.textContent)) {
					valueElem.textContent = convertDateToGerman(valueElem.textContent.trim());
					valueElem.dataset.dateProcessed = "true";
				}
			}

			// Define the context menu actions based on field types
			if (CONFIG.contextMenu) {
				const actions = fieldActions[fieldType];

				if (actions && actions.length > 0 && !valueElem.dataset.contextMenuSetup) {
					valueElem.dataset.contextMenuSetup = "true";
					valueElem.dataset.fieldType = fieldType;
					valueElem.style.cursor = "pointer";

					// Add context menu (right-click)
					valueElem.addEventListener("contextmenu", function(e) {
						e.preventDefault();
						e.stopPropagation();

						const text = extractCleanText(this);
						openContextMenu(e, this, text, actions, fieldType);
					});
				}
			}
		});

		// Beautify type labels
		if (CONFIG.capitalizeUserTypes) {
			capitalizeTypeLabels();
		}
	}

	// Predefined type labels are capitalized by Synology - but not user-defined ones, so we do that ourselves
	function capitalizeTypeLabels() {
		const selector = "[class*='ContactDetail__Type__'], [class*='ContactDetail__InlineType__']";

		document.querySelectorAll(selector).forEach(typeElem => {
			if (!typeElem.dataset.capitalizeProcessed) {
				const originalText = typeElem.textContent.trim();
				const capitalizedText = capitalizeWords(originalText);

				typeElem.textContent = capitalizedText;
				typeElem.dataset.capitalizeProcessed = "true";

				log(`Type label capitalized: ${originalText} → ${capitalizedText}`);
			}
		});
	}

	// Based on css class names set on the DIV elements, we can detect the kind (type) of field
	function detectFieldType(container, valueElem) {
		// Special case Email: Uses another class in another DIV
		if (valueElem.className.includes("EmailField__")) return "Email";

		// All others follow the same class naming schema
		if (container.querySelector("[class*='ContactDetail__Birthday__']")) return "Birthday";
		if (container.querySelector("[class*='ContactDetail__Date__']")) return "Date";
		if (container.querySelector("[class*='ContactDetail__Tel__']")) return "Tel";
		if (container.querySelector("[class*='ContactDetail__Adr__']")) return "Address";
		if (container.querySelector("[class*='ContactDetail__Url__']")) return "Url";
		if (container.querySelector("[class*='ContactDetail__Im__']")) return "Im";
		if (container.querySelector("[class*='ContactDetail__Note__']")) return "Note";

		log("Field type not found. Set to 'Unknown'");
		return "Unknown";
	}

	// ==================== CONTEXT MENU HANDLERS ====================

	function handleEmailSynology(text, fieldType, element) {
		// Let the original mail handler do his thing, we do nothing here.
		// This is just a placeholder in case someone wants to capture the original handler and rewrite it.

		log("Execute Synology EMail handler");
	}

	// Create mailto link and open in new tab
	function handleEmail(email, fieldType) {
		const mailtoUrl = "mailto:" + email;
		window.open(mailtoUrl, "_blank");

		log("Execute alternate EMail handler for address: " + email);
	}

	// Open URL in new browser tab
	function handleWebUrl(text, fieldType) {
		const url = text.startsWith("http") ? text : "https://" + text;
		window.open(url, "_blank");

		log("Execute handleWebUrl for URL: " + url);
	}

	// Do something with the data for phone numbers
	function handlePhoneNumber(phoneNumber, fieldType) {
		// This is a placeholder, we do not have any senseful action to perform yet

		log("Execute handlePhoneNumber: " + phoneNumber);
	}

	// Do something with the data for Instant Messengers
	function handleMessenger(data, fieldType) {
		// This is a placeholder, we do not have any senseful action to perform yet

		log("Execute handleMessenger: " + data);
	}

	// Do something with the data for Dates
	function handleCalendar(dateStr, fieldType) {
		// This is a placeholder, we do not have any senseful action to perform yet

		log("Execute handleCalendar: " + dateStr);
	}

	// Do something with the data for addresses
	function handleAddress(addressStr, fieldType) {
		// This is a placeholder, we do not have any senseful action to perform yet

		log("Execute handleAddress: " + addressStr);
	}

	// Copy the given text string into the clipboard
	function handleCopy2Clip(text, fieldType) {
		copyToClipboard(text);

		log("Execute handleCopy2Clip for text: " + text);
	}

	// Get text content from any node group and ignore type strings like "private", "mobile", "work" etc.
	function extractCleanText(element) {
		const texts = [];

		function collectText(node) {
			node.childNodes.forEach(child => {
				if (child.nodeType === Node.ELEMENT_NODE) {
					const className = child.className || "";

					// Ignore type labels
					if (className.includes("ContactDetail__Type__") || className.includes("ContactDetail__InlineType__")) {
						return;
					}

					// Recurse into all children
					collectText(child);
				} else if (child.nodeType === Node.TEXT_NODE) {
					// Recurse tail is reached
					const text = child.textContent.trim();
					if (text) texts.push(text);
				}
			});
		}

		collectText(element);

		// Concat the single text parts - we use a blank here.
		return texts.join(" ");
	}

	// ==================== CONTEXT MENU ====================

	let contextMenu = null;

	// Create the context menu
	function openContextMenu(event, element, text, actions, fieldType) {
		closeMenu();

		contextMenu = document.createElement("div");
		contextMenu.style.cssText = `
			position: fixed;
			background: rgba(8, 135, 216, 0.8);
			color: white;
			border-radius: 4px;
			font-size: 12px;
			z-index: 10002;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
			min-width: 180px;
		`;

		actions.forEach((actionDef, index) => {
			const item = document.createElement("div");
			item.textContent = actionDef.label;
			item.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.6);
                ${index === 0 ? "border-width: 0 0 1px 0; border-radius: 4px 4px 0 0;" : ""}
                ${index > 0 ? "border-width: 1px 0 1px 0; border-radius: 0px;" : ""}
                ${index === (actions.length-1) ? "border-width: 1px 0 0 0; border-radius: 0 0 4px 4px;" : ""}
                ${actions.length === 1 ? "border-width: 0 0 0 0; border-radius: 4px;" : ""}
			`;

			item.addEventListener("mouseenter", () => {
				item.style.background = "rgba(8, 135, 216, 0.9)";
			});

			item.addEventListener("mouseleave", () => {
				item.style.background = "transparent";
			});

			item.addEventListener("click", (e) => {
				e.stopPropagation();
				actionDef.action(text, fieldType);
				closeMenu();
			});

			contextMenu.appendChild(item);
		});

		document.body.appendChild(contextMenu);

		// Position at mouse cursor
		let left = event.clientX + 10;
		let top = event.clientY;

		const rect = contextMenu.getBoundingClientRect();

		// Proper positioning in x-axis
		if (left + rect.width > window.innerWidth - 10) {
			left = window.innerWidth - rect.width - 10;
		}

		// Proper positioning in y-axis
		if (top + rect.height > window.innerHeight - 10) {
			top = window.innerHeight - rect.height - 10;
		}

		contextMenu.style.left = left + "px";
		contextMenu.style.top = top + "px";

		// Close menu on any click
		setTimeout(() => {
			document.addEventListener("click", closeMenu);
			document.addEventListener("contextmenu", closeMenu);
		}, 50);
	}

	function closeMenu() {
		if (contextMenu) {
			contextMenu.remove();
			contextMenu = null;
			document.removeEventListener("click", closeMenu);
			document.removeEventListener("contextmenu", closeMenu);
		}
	}

	// ==================== INITIALIZATION ====================

	const observer = new MutationObserver(() => {
		transformContactList();
		formatContactCard();
		onEditModeChange();
	});

	setTimeout(() => {
		transformContactList();
		formatContactCard();
		observer.observe(document.body, { childList: true, subtree: true });
		log("Pimp my Synology Contacts: UserScript initialized");
	}, 1500);
})();
