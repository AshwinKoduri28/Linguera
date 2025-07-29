export function updateActiveMeetings(meetings, activeMeetingsDiv) {
  if (!activeMeetingsDiv) return;
  if (!Array.isArray(meetings) || meetings.length === 0) {
    activeMeetingsDiv.innerHTML = '<b>No Employees in Queue</b>';
    return;
  }
  function escapeHtml(str) {
    return String(str).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
  }
  // Language options for dropdown
  const languageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'hi-IN', label: 'Hindi' },
    { value: 'fr-FR', label: 'French' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'de-DE', label: 'German' }
  ];
  function getLanguageLabel(langCode) {
    const found = languageOptions.find(opt => opt.value === langCode);
    return found ? found.label : (langCode || '');
  }
  function getLanguageDropdown(id, lang) {
    return `<select id="lang-select-${id}" style="margin-left:10px; border-radius:10px; padding:2px 8px;">
      ${languageOptions.map(opt => `<option value="${opt.value}"${opt.value===lang?" selected":''}>${opt.label}</option>`).join('')}
    </select>`;
  }
  activeMeetingsDiv.innerHTML = '<b>Employees Queue:</b><br>' + meetings.map((m, idx) => {
    const disabled = m.participants >= 2 ? 'disabled' : '';
    const btnText = m.participants >= 2 ? 'Room is full' : 'Join';
    const safeRoomId = escapeHtml(m.roomId);
    const langLabel = getLanguageLabel(m.lang);
    const langDropdown = getLanguageDropdown(idx, m.lang);
    return `<div style='margin:6px 0;'>Room: <b>${safeRoomId}</b> | Participants: ${m.participants} | Language: <b>${langLabel}</b> ${langDropdown} <button ${disabled} onclick="window.joinMeetingWithLang('${safeRoomId}', 'lang-select-${idx}')">${btnText}</button></div>`;
  }).join('');
}

// Helper for language dropdown beside Join button
window.joinMeetingWithLang = function(roomId, selectId) {
  const langSelect = document.getElementById(selectId);
  const lang = langSelect ? langSelect.value : undefined;
  window.joinMeeting(roomId, lang);
};
