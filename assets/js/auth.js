import { toast } from './app.js';

const form = document.querySelector('[data-auth-form]');
if (form) {
  const error = document.querySelector('[data-auth-error]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    if (!form.reportValidity()) return;

    const value = (name) => form.querySelector(`[data-auth-field="${name}"]`)?.value;
    if (value('confirmPassword') !== undefined && value('password') !== value('confirmPassword')) {
      error.textContent = 'The passwords do not match.';
      error.hidden = false;
      form.querySelector('[data-auth-field="confirmPassword"]')?.focus();
      return;
    }

    toast({
      title: 'Frontend demo only',
      message: 'No account, password or reset request was created or sent.',
      variant: 'info',
    });
  });
}
