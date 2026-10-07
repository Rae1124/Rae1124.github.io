export const isDesktop = Boolean(window.desktopApi);

export async function promptForText(label, initial = '', secret = false) {
  if (!isDesktop) return window.prompt(label, initial);
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modalBox" role="dialog" aria-modal="true" aria-labelledby="promptLabel">
        <form class="form" id="promptForm">
          <label id="promptLabel" for="promptInput"></label>
          <input id="promptInput" autocomplete="off">
          <div class="actions">
            <button class="outline" type="button" id="promptCancel">Cancel</button>
            <button class="primary" type="submit">Continue</button>
          </div>
        </form>
      </div>`;
    modal.querySelector('label').textContent = label;
    const input = modal.querySelector('input');
    input.type = secret ? 'password' : 'text';
    input.value = initial;
    const finish = (value) => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector('form').onsubmit = (event) => {
      event.preventDefault();
      finish(input.value);
    };
    modal.querySelector('#promptCancel').onclick = () => finish(null);
    modal.onkeydown = (event) => {
      if (event.key === 'Escape') finish(null);
    };
    document.body.append(modal);
    input.focus();
  });
}
