'use strict';
function assertTrustedSender(event, window, expectedUrl) {
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    !event.senderFrame ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame.url !== expectedUrl
  )
    throw Error('Untrusted desktop request.');
}
function registerHandler(ipcMain, channel, getWindow, expectedUrl, handler) {
  ipcMain.handle(channel, async (event, input) => {
    try {
      assertTrustedSender(event, getWindow(), expectedUrl);
      return { ok: true, value: await handler(input) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Request failed.' };
    }
  });
}
module.exports = { assertTrustedSender, registerHandler };
