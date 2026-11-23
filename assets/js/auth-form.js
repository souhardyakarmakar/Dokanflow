const form = document.querySelector('[data-auth-form]');

if (form) {
  const password = form.elements.namedItem('password');
  const meter = form.querySelector('[data-password-strength-meter]');
  const strengthText = form.querySelector('[data-password-strength-text]');
  const confirmation = form.elements.namedItem('confirm_password');
  const error = form.querySelector('[data-auth-error]');

  const updateStrength = () => {
    if (!password || !meter || !strengthText) return;

    const value = password.value;
    const score = value.length === 0
      ? 0
      : Number(value.length >= 6)
        + Number(value.length >= 10)
        + Number(/[a-z]/.test(value) && /[A-Z]/.test(value))
        + Number(/[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value));
    const label = value.length === 0
      ? 'Not entered'
      : value.length < 6
        ? 'Too short'
        : ['Weak', 'Fair', 'Good', 'Strong'][Math.max(0, score - 1)];

    meter.setAttribute('aria-valuenow', String(score));
    meter.setAttribute('aria-valuetext', label);
    meter.dataset.strength = label.toLowerCase().replaceAll(' ', '-');
    strengthText.textContent = label;
  };

  const validateConfirmation = () => {
    if (!(password instanceof HTMLInputElement) || !(confirmation instanceof HTMLInputElement)) return;
    confirmation.setCustomValidity(
      confirmation.value !== '' && confirmation.value !== password.value
        ? 'The passwords do not match.'
        : '',
    );
    if (confirmation.validity.valid && error) error.hidden = true;
  };

  if (password instanceof HTMLInputElement) password.addEventListener('input', () => {
    updateStrength();
    validateConfirmation();
  });
  if (confirmation instanceof HTMLInputElement) {
    confirmation.addEventListener('input', validateConfirmation);
    confirmation.addEventListener('invalid', () => {
      if (!error) return;
      error.textContent = confirmation.validationMessage;
      error.hidden = false;
    });
  }

  form.addEventListener('submit', (event) => {
    validateConfirmation();
    if (!confirmation || confirmation.validity.valid) return;
    event.preventDefault();
    if (error) {
      error.textContent = confirmation.validationMessage;
      error.hidden = false;
    }
    confirmation.focus();
  });
}

const passwordRevealStates = new WeakMap();

const clearPasswordReveal = (input) => {
  const state = passwordRevealStates.get(input);
  if (!state) return;

  window.clearTimeout(state.timer);
  passwordRevealStates.delete(input);
  input.closest('.password-input-wrap')?.classList.remove('is-password-revealing');
  state.overlay.textContent = '';
};

const revealLatestCharacter = (input, event) => {
  if (input.type !== 'password' || input.value.length === 0) return;

  const inputType = typeof event.inputType === 'string' ? event.inputType : '';
  if (!inputType.startsWith('insert')) return;

  const value = input.value;
  const end = input.selectionStart ?? value.length;
  let start = Math.max(0, end - 1);
  const lastCodeUnit = value.charCodeAt(start);
  if (lastCodeUnit >= 0xdc00 && lastCodeUnit <= 0xdfff && start > 0) {
    const previousCodeUnit = value.charCodeAt(start - 1);
    if (previousCodeUnit >= 0xd800 && previousCodeUnit <= 0xdbff) start -= 1;
  }

  const display = `${'•'.repeat(start)}${value.slice(start, end)}${'•'.repeat(value.length - end)}`;
  const wrapper = input.closest('.password-input-wrap');
  if (!wrapper) return;
  clearPasswordReveal(input);

  let overlay = wrapper.querySelector('[data-password-reveal]');
  if (!(overlay instanceof HTMLSpanElement)) {
    overlay = document.createElement('span');
    overlay.className = 'password-reveal-text';
    overlay.dataset.passwordReveal = '';
    overlay.setAttribute('aria-hidden', 'true');
    wrapper.append(overlay);
  }
  overlay.textContent = display;
  overlay.style.transform = `translateY(-50%) translateX(-${input.scrollLeft}px)`;
  wrapper.classList.add('is-password-revealing');

  const state = {
    overlay,
    timer: window.setTimeout(() => clearPasswordReveal(input), 700),
  };
  passwordRevealStates.set(input, state);
};

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  const input = button.closest('.password-input-wrap')?.querySelector('input');
  if (!(input instanceof HTMLInputElement)) return;

  input.addEventListener('keydown', () => clearPasswordReveal(input));
  input.addEventListener('beforeinput', () => clearPasswordReveal(input));
  input.addEventListener('pointerdown', () => clearPasswordReveal(input));
  input.addEventListener('paste', () => clearPasswordReveal(input));
  input.addEventListener('cut', () => clearPasswordReveal(input));
  input.addEventListener('compositionstart', () => clearPasswordReveal(input));
  input.addEventListener('scroll', () => {
    const state = passwordRevealStates.get(input);
    if (state) state.overlay.style.transform = `translateY(-50%) translateX(-${input.scrollLeft}px)`;
  });
  input.addEventListener('input', (event) => revealLatestCharacter(input, event));
  input.form?.addEventListener('submit', () => clearPasswordReveal(input), { capture: true });

  button.addEventListener('click', () => {
    clearPasswordReveal(input);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.setAttribute('aria-label', `${showing ? 'Show' : 'Hide'} ${input.name.replaceAll('_', ' ')}`);
    button.setAttribute('aria-pressed', String(!showing));
    button.querySelector('use')?.setAttribute(
      'href',
      `assets/img/icons.svg#${showing ? 'i-eye' : 'i-eye-off'}`,
    );
  });
});

document.querySelectorAll('[data-submit-lock]').forEach((lockedForm) => {
  lockedForm.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    submitter.disabled = true;
    submitter.textContent = 'Please wait…';
  });
});
