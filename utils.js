import { projectOrigin } from './config.js';

export function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}
export function isApprovedDocumentUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === projectOrigin &&
      url.pathname.startsWith('/storage/v1/object/sign/') &&
      Boolean(url.searchParams.get('token')) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function roleLabel(role) {
  switch (role) {
    case 'student':
      return 'Student';
    case 'registrar':
      return 'Registrar';
    case 'idoffice':
      return 'ID Office';
    default:
      return 'Administrator';
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',').pop());
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFormValues(form, names) {
  return Object.fromEntries(names.map((name) => [name, form.elements.namedItem(name).value]));
}
