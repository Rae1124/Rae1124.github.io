import { requestDocuments } from '../api.js';
import { sessionState } from '../state.js';
import { isDesktop, promptForText } from '../platform.js';
import { escapeHTML, isApprovedDocumentUrl } from '../utils.js';
import { renderMessage } from '../ui.js';

function renderDocument(document, canReview) {
  const label = document.kind === 'photo' ? 'ID Photo' : 'Affidavit of Loss';
  const status = document.verified
    ? 'Verified'
    : document.invalid_reason
      ? `Invalid: ${document.invalid_reason}`
      : 'Not yet reviewed';
  const documentId = escapeHTML(document.id);
  return `<div class="docItem"><div class="docTop">
    <div>
      <div class="docName">${label} — ${escapeHTML(document.file_name)}</div>
      <div class="docMeta">${escapeHTML(document.content_type)} · ${(Number(document.size_bytes || 0) / 1024).toFixed(1)} KB</div>
      <div class="docStatus">${escapeHTML(status)}</div>
    </div>
    <div class="actions">
      ${document.can_view || document.view_url ? `<button class="outline" data-view="${documentId}">View</button>` : '<span class="muted">Preview unavailable</span>'}
      ${canReview ? `<button class="primary" data-verify="${documentId}">Verify</button><button class="danger" data-invalid="${documentId}">Mark Invalid</button>` : ''}
    </div>
  </div></div>`;
}

function createDocumentsModal(applicationNumber) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'documentModal';
  modal.innerHTML = `<div class="modalBox">
    <div class="sectionHead">
      <div><span class="eyebrow">APPLICATION ${escapeHTML(applicationNumber)}</span><h2>Uploaded Documents</h2></div>
      <button class="outline" id="closeDocuments">Close</button>
    </div>
    <div id="documentBody"><div class="panel">Loading documents…</div></div>
  </div>`;
  modal.querySelector('#closeDocuments').onclick = () => modal.remove();
  document.body.append(modal);
  return modal;
}

export async function showDocuments(requestId, applicationNumber) {
  const modal = createDocumentsModal(applicationNumber);
  const body = modal.querySelector('#documentBody');
  try {
    const { documents } = await requestDocuments(
      `?request_id=${encodeURIComponent(requestId)}&metadata_only=true`,
    );
    const canReview = ['registrar', 'admin'].includes(sessionState.user.role);
    body.innerHTML = documents.length
      ? `<div class="docList">${documents.map((document) => renderDocument(document, canReview)).join('')}</div>`
      : '<div class="panel">No uploaded documents found.</div>';
    body.querySelectorAll('[data-view]').forEach((button) => {
      button.onclick = () => openDocument(button, requestId);
    });
    body.querySelectorAll('[data-verify]').forEach((button) => {
      button.onclick = () =>
        reviewDocument(modal, button.dataset.verify, true, requestId, applicationNumber);
    });
    body.querySelectorAll('[data-invalid]').forEach((button) => {
      button.onclick = () =>
        reviewDocument(modal, button.dataset.invalid, false, requestId, applicationNumber);
    });
  } catch (error) {
    body.innerHTML = renderMessage(error.message);
  }
}

async function openDocument(button, requestId) {
  button.disabled = true;
  // Open synchronously to retain the browser's user gesture, then remove opener access.
  const preview = isDesktop ? null : window.open('about:blank', '_blank');
  if (preview) preview.opener = null;
  try {
    const result = await requestDocuments(
      `?request_id=${encodeURIComponent(requestId)}&document_id=${encodeURIComponent(button.dataset.view)}`,
    );
    const url = result.documents?.[0]?.view_url;
    if (!isApprovedDocumentUrl(url))
      throw Error('Document preview is unavailable. Please try again.');
    if (isDesktop) await window.desktopApi.openSignedDocument(url);
    else if (preview) preview.location.replace(url);
    else throw Error('Allow document previews in your browser and try again.');
  } catch (error) {
    if (preview) preview.close();
    alert(error.message);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function reviewDocument(modal, documentId, verified, requestId, applicationNumber) {
  let reason = '';
  if (!verified) {
    reason = (await promptForText('Why is this document invalid?', '')) || '';
    if (!reason.trim()) return;
  }
  try {
    await requestDocuments('', {
      method: 'PUT',
      body: JSON.stringify({ document_id: documentId, verified, invalid_reason: reason }),
    });
    modal.remove();
    void showDocuments(requestId, applicationNumber);
  } catch (error) {
    alert(error.message);
  }
}
