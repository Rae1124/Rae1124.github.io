import { requestApi, requestStaffLogin } from './api.js';
import { sessionState, saveToken, clearToken } from './state.js';
import { systemName, studentPrograms, yearLevels, turnstileSiteKey } from './config.js';
import { escapeHTML, readFormValues } from './utils.js';
import {
  renderAuthShell,
  renderAuthHeader,
  renderField,
  renderFieldGrid,
  renderMessage,
} from './ui.js';

export function createAuth(onAuthenticated) {
  let captchaToken = '';
  let captchaWidgetId = null;
  let captchaGeneration = 0;
  let captchaExpiry;
  function resetCaptchaState() {
    // Ignore verification callbacks from abandoned forms or changed credentials.
    captchaGeneration++;
    clearTimeout(captchaExpiry);
    if (window.turnstile && captchaWidgetId !== null) {
      try {
        window.turnstile.remove(captchaWidgetId);
      } catch {}
    }
    captchaToken = '';
    captchaWidgetId = null;
  }
  function setStaffLoginEnabled(enabled) {
    const button = document.getElementById('loginButton');
    if (button)
      button.disabled = !enabled || document.getElementById('loginForm')?.dataset.busy === 'true';
  }
  function renderStaffCaptcha(attempt = 0, generation = captchaGeneration) {
    const holder = document.getElementById('turnstile-widget');
    if (!holder || generation !== captchaGeneration) return;
    if (window.desktopApi) {
      holder.innerHTML =
        '<button id="verifyHuman" type="button" class="outline">Verify I’m Human</button><span id="verifyStatus" role="status"></span>';
      const button = document.getElementById('verifyHuman'),
        status = document.getElementById('verifyStatus');
      button.onclick = async () => {
        button.disabled = true;
        status.textContent = ' Opening verification…';
        try {
          const token = await window.desktopApi.requestCaptcha();
          if (generation !== captchaGeneration) return;
          captchaToken = token;
          status.textContent = ' Verified';
          setStaffLoginEnabled(true);
          clearTimeout(captchaExpiry);
          captchaExpiry = setTimeout(() => {
            if (generation === captchaGeneration) resetStaffCaptcha();
          }, 240000);
        } catch (error) {
          if (generation === captchaGeneration) {
            captchaToken = '';
            setStaffLoginEnabled(false);
            status.textContent = error.message;
          }
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      };
      return;
    }
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      captchaWidgetId = window.turnstile.render(holder, {
        sitekey: turnstileSiteKey,
        action: 'staff_login',
        appearance: 'always',
        theme: 'light',
        size: 'flexible',
        callback(token) {
          if (generation === captchaGeneration) {
            captchaToken = token;
            setStaffLoginEnabled(true);
          }
        },
        'expired-callback'() {
          if (generation === captchaGeneration) {
            captchaToken = '';
            setStaffLoginEnabled(false);
          }
        },
        'error-callback'() {
          if (generation === captchaGeneration) {
            captchaToken = '';
            setStaffLoginEnabled(false);
            const message = document.getElementById('formMessage');
            if (message)
              message.textContent =
                'Human verification could not load. Check your connection and try again.';
          }
        },
      });
      return;
    }
    if (attempt < 100) return setTimeout(() => renderStaffCaptcha(attempt + 1, generation), 100);
    const message = document.getElementById('formMessage');
    if (message)
      message.textContent =
        'Human verification could not load. Check your connection and refresh the page.';
  }
  function resetStaffCaptcha() {
    resetCaptchaState();
    setStaffLoginEnabled(false);
    renderStaffCaptcha();
  }
  function showLogin(initialMessage = '') {
    resetCaptchaState();

    renderAuthShell(renderLoginForm());
    const form = document.getElementById('loginForm'),
      identifier = document.getElementById('identifierInput'),
      password = document.getElementById('passwordInput');
    const remember = document.getElementById('rememberInput'),
      message = document.getElementById('formMessage'),
      button = document.getElementById('loginButton'),
      verification = document.getElementById('staffVerification');
    let requiresCaptcha = false,
      busy = false;
    function showMessage(text, kind = 'error') {
      const notice = document.createElement('div');
      notice.className = 'msg ' + kind;
      notice.textContent = text;
      message.replaceChildren(notice);
    }
    if (initialMessage) showMessage(initialMessage, 'success');
    document.getElementById('registerButton').onclick = () => {
      resetCaptchaState();
      showRegistration();
    };
    document.getElementById('forgotPasswordButton').onclick = () =>
      alert('If email recovery is unavailable, ask an Administrator to reset your password.');
    requestApi('/auth/setup-status')
      .then((status) => {
        if (!form.isConnected || status.adminExists !== false) return;
        const setup = document.createElement('button');
        setup.type = 'button';
        setup.textContent = 'Set Up Administrator';
        setup.onclick = () => {
          resetCaptchaState();
          showAdminSetup();
        };
        document.getElementById('loginLinks').append(setup);
      })
      .catch(() => {});
    function credentialsChanged() {
      resetCaptchaState();
      requiresCaptcha = false;
      verification.replaceChildren();
      message.replaceChildren();
      button.disabled = busy;
    }
    identifier.oninput = credentialsChanged;
    password.oninput = credentialsChanged;
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      message.replaceChildren();
      if (!identifier.value.trim() || !password.value) {
        showMessage('Enter your login ID and password.');
        return;
      }
      if (requiresCaptcha && !captchaToken) {
        showMessage('Complete the human verification before logging in.');
        return;
      }
      const generation = captchaGeneration;
      const payload = {
        identifier: identifier.value.trim(),
        password: password.value,
        remember: remember.checked,
      };
      busy = true;
      form.dataset.busy = 'true';
      button.disabled = true;
      button.textContent = 'Signing in…';
      try {
        const data = requiresCaptcha
          ? await requestStaffLogin({ ...payload, captchaToken })
          : await requestApi('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
        if (!form.isConnected || generation !== captchaGeneration) return;
        if (data.requiresCaptcha) {
          requiresCaptcha = true;
          verification.innerHTML = `<div class="captchaBlock">
            <span class="captchaLabel">Staff Security Verification</span>
            <div class="turnstileWrap"><div id="turnstile-widget"></div></div>
            <div class="captchaHint">Verify that you are human, then select Login to continue.</div>
          </div>`;
          renderStaffCaptcha();
          return;
        }
        if (
          typeof data.token !== 'string' ||
          !data.token ||
          !['student', 'registrar', 'idoffice', 'admin'].includes(data.user?.role)
        )
          throw Error('Unable to sign in. Please try again.');
        resetCaptchaState();
        saveToken(data.token, payload.remember);
        sessionState.user = data.user;

        sessionState.view = 'Dashboard';
        onAuthenticated();
      } catch (error) {
        if (!form.isConnected || generation !== captchaGeneration) return;
        showMessage(error.message);
        if (requiresCaptcha) resetStaffCaptcha();
      } finally {
        busy = false;
        form.dataset.busy = 'false';
        if (form.isConnected) {
          button.textContent = 'Login';
          button.disabled = requiresCaptcha && !captchaToken;
        }
      }
    };
  }

  function renderLoginForm() {
    return `
    <span class="eyebrow">SECURE SCHOOL LOGIN</span>
    <h2>School Login</h2>
    <p class="muted">Sign in to access your account and dashboard.</p>
    <form class="form" id="loginForm">
      ${renderField({ name: 'identifierInput', label: 'Student ID, Username, or Email', required: true, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' })}
      ${renderField({ name: 'passwordInput', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' })}
      <div id="staffVerification"></div>
      <label class="remember"><input id="rememberInput" type="checkbox"> Remember me on this device</label>
      <div id="formMessage" aria-live="polite"></div>
      <button id="loginButton" class="primary wide">Login</button>
    </form>
    <div class="links" id="loginLinks">
      <button id="registerButton" type="button">Create Student Profile</button>
      <button id="forgotPasswordButton" type="button">Forgot Password?</button>
    </div>
    <div class="footer">${systemName}</div>`;
  }

  function showProfileForm({ title, label, description, fields, path, successMessage }) {
    renderAuthShell(`
    ${renderAuthHeader(label)}
    <h2>${escapeHTML(title)}</h2>
    <p class="muted">${escapeHTML(description)}</p>
    <form class="form" id="profileForm">
      ${renderFieldGrid(fields)}
      <div id="formMessage"></div>
      <button class="primary wide">${escapeHTML(title)}</button>
    </form>`);
    const form = document.getElementById('profileForm');
    const message = document.getElementById('formMessage');
    document.getElementById('backButton').onclick = () => showLogin();
    form.onsubmit = async (event) => {
      event.preventDefault();
      const values = readFormValues(
        form,
        fields.map((field) => field.name),
      );
      if (values.password !== values.confirmPassword) {
        message.innerHTML = renderMessage('Passwords do not match.');
        return;
      }
      delete values.confirmPassword;
      try {
        await requestApi(path, { method: 'POST', body: JSON.stringify(values) });
        showLogin(successMessage);
      } catch (error) {
        message.innerHTML = renderMessage(error.message);
      }
    };
  }

  function showRegistration() {
    showProfileForm({
      title: 'Create Student Profile',
      label: 'STUDENT REGISTRATION',
      description: 'Create your school-system account to apply for and track an ID replacement.',
      fields: [
        { name: 'studentId', label: 'Student ID', required: true },
        { name: 'firstName', label: 'First Name', required: true },
        { name: 'middleName', label: 'Middle Name' },
        { name: 'lastName', label: 'Last Name', required: true },
        { name: 'email', label: 'School Email', type: 'email', required: true },
        { name: 'contactNumber', label: 'Contact Number' },
        { name: 'address', label: 'Address', full: true },
        { name: 'program', label: 'Course / Program', options: studentPrograms },
        { name: 'yearLevel', label: 'Year Level', options: yearLevels },
        { name: 'section', label: 'Section', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
      ],
      path: '/auth/register-student',
      successMessage: 'Profile created successfully. You can now log in.',
    });
  }

  function showAdminSetup() {
    showProfileForm({
      title: 'Create Initial Administrator',
      label: 'ONE-TIME SETUP',
      description: 'This setup disappears after the first Administrator is created.',
      fields: [
        { name: 'firstName', label: 'First Name', required: true },
        { name: 'middleName', label: 'Middle Name' },
        { name: 'lastName', label: 'Last Name', required: true },
        { name: 'username', label: 'Username', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true, full: true },
        { name: 'password', label: 'Password', type: 'password', required: true },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
      ],
      path: '/auth/setup-admin',
      successMessage: 'Administrator created successfully.',
    });
  }

  async function start() {
    let connectionError = '';
    if (sessionState.token) {
      try {
        const data = await requestApi('/auth/me');
        sessionState.user = data.user;
        onAuthenticated();
        return;
      } catch (error) {
        // The desktop retains remembered sessions on a transport failure.
        if (
          window.desktopApi &&
          error.message.startsWith(`Unable to connect to the ${systemName}.`)
        ) {
          connectionError = error.message;
        } else {
          clearToken();
        }
      }
    }
    showLogin();
    if (connectionError) {
      const message = document.createElement('div');
      message.className = 'msg error';
      message.setAttribute('role', 'alert');
      message.textContent = connectionError;
      document.querySelector('.card').append(message);
    }
  }

  return { showLogin, start };
}
