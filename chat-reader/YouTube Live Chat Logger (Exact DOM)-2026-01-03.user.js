// ==UserScript==
// @name         YouTube Live Chat Logger (Exact DOM)
// @namespace    http://tampermonkey.net/
// @version      2026-01-03
// @description  Logs each YouTube livestream chat message using MutationObserver
// @author       You
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log('[YT Chat Logger] Loaded');

    function onChatMessage({ id, author, message, timestamp }) {
        console.log('[YT Chat]', { id, author, message, timestamp });
        sendMessage({ id, author, message, timestamp })
    }

    function parseMessage(node) {
        return {
            id: node.getAttribute('id'),
            author: node.querySelector('#author-name')?.textContent?.trim() ?? '',
            message: node.querySelector('#message')?.textContent?.trim() ?? '',
            timestamp: node.querySelector('#timestamp')?.textContent?.trim() ?? ''
        };
    }

    function attachMessageObserver(itemsContainer) {
        const messageObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (
                        node instanceof HTMLElement &&
                        node.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER'
                    ) {
                        onChatMessage(parseMessage(node));
                    }
                }
            }
        });

        messageObserver.observe(itemsContainer, {
            childList: true
        });

        console.log('[YT Chat Logger] Message observer attached');
    }

    // Root observer: waits for #items to appear
    const rootObserver = new MutationObserver(() => {
        const items = document.querySelector('.yt-live-chat-item-list-renderer #items');
        const text = items.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.innerText
        if (!text.startsWith('Live chat')) return;

        if (items) {
             console.log('[EBLO] found messages window')

            attachMessageObserver(items);
            rootObserver.disconnect();
        }
    });

    rootObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    console.log('[EBLO] IS HERE')

    const WS_URL = "ws://localhost:8585/source"

    let ws = null
    let reconnectTimer = null

    const RECONNECT_DELAY_MS = 1000

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return

        ws = new WebSocket(WS_URL)

        ws.onopen = () => {
            console.log("WS connected")

            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer)
                reconnectTimer = null
            }
        }

        ws.onmessage = event => {
            console.log("WS message:", event.data)
        }

        ws.onerror = err => {
            console.error("WS error", err)
            ws?.close()
        }

        ws.onclose = () => {
            console.log("WS closed, reconnecting...")
            scheduleReconnect()
        }
    }

    /**
 * Schedule reconnect
 */
    function scheduleReconnect() {
        if (reconnectTimer !== null) return

        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null
            connect()
        }, RECONNECT_DELAY_MS)
    }

    connect()

    function sendMessage(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn("WS not connected, message dropped");
            return;
        }

        ws.send(
            typeof data === "string" ? data : JSON.stringify(data)
        );
    }

})();
