const otpForm = document.querySelector('[data-otp-form]');

if (otpForm) {
  const inputs = Array.from(otpForm.querySelectorAll('.otp-input'));
  const combined = otpForm.elements.namedItem('otp');
  const resendButton = otpForm.querySelector('[data-resend-button]');
  const countdown = otpForm.querySelector('[data-resend-countdown]');

  const syncCode = () => {
    if (combined instanceof HTMLInputElement) {
      combined.value = inputs.map((input) => input.value).join('');
    }
  };

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      if (digits.length > 1) {
        digits.slice(0, inputs.length - index).split('').forEach((digit, offset) => {
          inputs[index + offset].value = digit;
        });
        inputs[Math.min(inputs.length - 1, index + digits.length)].focus();
      } else {
        input.value = digits.slice(-1);
        if (input.value && inputs[index + 1]) inputs[index + 1].focus();
      }
      syncCode();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && input.value === '' && inputs[index - 1]) {
        inputs[index - 1].focus();
      } else if (event.key === 'ArrowLeft' && inputs[index - 1]) {
        event.preventDefault();
        inputs[index - 1].focus();
      } else if (event.key === 'ArrowRight' && inputs[index + 1]) {
        event.preventDefault();
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text') || '';
      const digits = pasted.replace(/\D/g, '').slice(0, inputs.length - index);
      if (!digits) return;
      event.preventDefault();
      digits.split('').forEach((digit, digitIndex) => {
        inputs[index + digitIndex].value = digit;
      });
      syncCode();
      inputs[Math.min(index + digits.length, inputs.length) - 1].focus();
    });
  });

  let seconds = Math.max(0, Number(otpForm.dataset.resendWait) || 0);
  const updateCountdown = () => {
    if (!resendButton || !countdown) return;
    resendButton.disabled = seconds > 0;
    countdown.textContent = seconds > 0 ? `(${seconds}s)` : '';
    if (seconds > 0) seconds -= 1;
    if (seconds >= 0 && resendButton.disabled) window.setTimeout(updateCountdown, 1000);
  };
  updateCountdown();

  otpForm.addEventListener('submit', (event) => {
    syncCode();
    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    if (submitter.value === 'verify' && combined instanceof HTMLInputElement && combined.value.length !== 6) {
      event.preventDefault();
      inputs.find((input) => input.value === '')?.focus();
      return;
    }
    submitter.disabled = true;
    submitter.textContent = submitter.value === 'resend' ? 'Sending…' : 'Verifying…';
  });
}
