const form = document.getElementById('profile-form');
if (form) {
  const fields = form.elements;

  const updateSummary = () => {
    const name = fields.owner.value.trim() || 'DokanFlow profile';
    document.getElementById('profile-summary-name').textContent = name;
    document.getElementById('profile-avatar').textContent = name.split(/\s+/).slice(0, 2)
      .map((part) => part[0]).join('').toUpperCase();
  };
  updateSummary();
  fields.owner.addEventListener('input', updateSummary);
}
