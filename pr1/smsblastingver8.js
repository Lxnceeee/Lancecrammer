// Extracted from smsblastingver8.html
// Keep behavior identical; loaded after DOM markup.

// Default configuration
    const defaultConfig = {
      app_title: 'Taal High School',
      send_button_text: 'Send Message',
      user_name: 'User',
      user_role: 'Teacher',
      user_avatar: ''
    };
    const appConfig = { ...defaultConfig };
    let currentAccountUsername = '';
    const activityLog = [];
    let activityFilter = 'all';
    const PRIVILEGED_ACTIVITY_ROLES = ['Developer'];
    let roleRequestCounter = 0;

// Recipient selection logic
    const radioAll = document.getElementById('radio-all');
    const radioGrade = document.getElementById('radio-grade');
    const gradeSelection = document.getElementById('grade-selection');
    const gradeDropdown = document.getElementById('grade-dropdown');
    const sectionContainer = document.getElementById('section-container');
    const sectionDropdown = document.getElementById('section-dropdown');
    const summaryText = document.getElementById('summary-text');
    const contactGradeInput = document.getElementById('contact-grade-input');
    const contactSectionInput = document.getElementById('contact-section-input');
    const studentContacts = [];
    const parentContacts = [];
    const STORAGE_KEY = 'ths_contacts_v1';
    const MESSAGE_LOG_KEY = 'ths_message_log_v1';
    const MESSAGE_LOG_MAX_ITEMS = 300;
    const MESSAGE_TEMPLATES_KEY = 'ths_message_templates_v1';
    const USER_PROFILES_KEY = 'parent_connect_user_profiles_v1';
    const USERS_KEY = 'parent_connect_users_v1';
    const ACCOUNT_REQUESTS_KEY = 'parent_connect_account_requests_v1';
    const ACTIVITY_RESET_FLAG_KEY = 'parent_connect_activity_reset_v1';

    // Toggle grade selection visibility
    radioAll.addEventListener('change', function() {
      if (this.checked) {
        gradeSelection.classList.add('hidden');
        sectionContainer.classList.add('hidden');
        gradeDropdown.value = '';
        sectionDropdown.value = '';
        updateSummary();
        renderContacts();
        // When All Students is selected, return to Message Log
    
        showMessageLog();
      }
    });

    radioGrade.addEventListener('change', function() {
      if (this.checked) {
        gradeSelection.classList.remove('hidden');
        updateSummary();
        renderContacts();
      }
    });

    // Show section dropdown when grade is selected
    gradeDropdown.addEventListener('change', function() {
      if (this.value) {
        sectionContainer.classList.remove('hidden');
        updateSectionOptions(this.value);
      } else {
        sectionContainer.classList.add('hidden');
        sectionDropdown.value = '';
      }
      updateSummary();
      renderContacts();
    });
    
    // Update section options based on grade
    function getSectionOptions(grade) {
      if (grade === '11') {
        return [
          { value: 'gas', label: 'GAS' },
          { value: 'abm', label: 'ABM' },
          { value: 'stem', label: 'STEM' },
          { value: 'ce', label: 'CE' },
          { value: 'cp', label: 'CP' },
          { value: 'he1', label: 'HE-1' },
          { value: 'he2', label: 'HE-2' },
          { value: 'humms1', label: 'HUMMS-1' },
          { value: 'humms2', label: 'HUMMS-2' },
          { value: 'humms3', label: 'HUMMS-3' },
          { value: 'humms4', label: 'HUMMS-4' }
        ];
      }
      if (grade === '12') {
        return [
          { value: 'gas', label: 'GAS' },
          { value: 'abm', label: 'ABM' },
          { value: 'stem', label: 'STEM' },
          { value: 'ce', label: 'CE' },
          { value: 'cp1', label: 'CP-1' },
          { value: 'cp2', label: 'CP-2' },
          { value: 'he1', label: 'HE-1' },
          { value: 'he2', label: 'HE-2' },
          { value: 'humms1', label: 'HUMMS-1' },
          { value: 'humms2', label: 'HUMMS-2' },
          { value: 'humms3', label: 'HUMMS-3' },
          { value: 'humms4', label: 'HUMMS-4' }
        ];
      }
      return [];
    }

    function getSectionLabel(grade, value) {
      if (!value) return '';
      const match = getSectionOptions(grade).find(opt => opt.value === value);
      return match ? match.label : value.toUpperCase();
    }

    function updateSectionOptions(grade) {
      sectionDropdown.innerHTML = '<option value="">Choose a section...</option><option value="all">All</option>';
      getSectionOptions(grade).forEach(opt => {
        sectionDropdown.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
      });
    }

    function updateContactSectionOptions(grade) {
      contactSectionInput.innerHTML = '<option value="">Select section...</option>';
      getSectionOptions(grade).forEach(opt => {
        contactSectionInput.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
      });
    }

    function canCreateContactsInCurrentSelection() {
      return radioGrade.checked && !!gradeDropdown.value && !!sectionDropdown.value && sectionDropdown.value !== 'all';
    }

    function updateCreateButtonsDisabledState() {
      const addStudentBtn = document.getElementById('add-student-btn');
      const addParentBtn = document.getElementById('add-parent-btn');
      const canCreate = canCreateContactsInCurrentSelection();
      const hint = canCreate ? '' : 'Select grade + section first';
      [addStudentBtn, addParentBtn].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !canCreate;
        btn.style.opacity = canCreate ? '1' : '0.55';
        btn.style.cursor = canCreate ? 'pointer' : 'not-allowed';
        btn.title = hint;
      });
    }

// Update summary when section changes
    sectionDropdown.addEventListener('change', function() {
      updateSummary();
      renderContacts();
    });

    // Update summary text based on selections
    function getAllContacts() {
      return [...studentContacts, ...parentContacts];
    }

    function getSelectedContacts() {
      return getAllContacts().filter(contact => contact.selected);
    }

    function filterContactsBySelection(contacts) {
      if (!radioGrade.checked) {
        return contacts;
      }

      const grade = gradeDropdown.value;
      const section = sectionDropdown.value;
      if (!grade || !section) {
        return [];
      }

      if (section === 'all') {
        return contacts.filter(c => c.grade === grade);
      }

      return contacts.filter(c => c.grade === grade && c.section === section);
    }

    function normalizePhone(phone) {
      let value = (phone || '').trim();
      if (!value) return '';

      // Keep only digits and an optional leading plus.
      value = value.replace(/[^\d+]/g, '');
      if (value.startsWith('+')) {
        value = '+' + value.slice(1).replace(/\D/g, '');
      } else {
        value = value.replace(/\D/g, '');
      }

      // Convert common PH formats to +63.
      if (value.startsWith('+63')) {
        return '+63' + value.slice(3);
      }
      if (value.startsWith('63')) {
        return '+' + value;
      }
      if (value.startsWith('0')) {
        return '+63' + value.slice(1);
      }
      if (value.startsWith('9') && value.length === 10) {
        return '+63' + value;
      }

      return value;
    }

    function toLocalDisplayPhone(phone) {
      const value = String(phone || '').trim();
      if (value.startsWith('+63') && value.length === 13) {
        return `0${value.slice(3)}`;
      }
      if (value.startsWith('63') && value.length === 12) {
        return `0${value.slice(2)}`;
      }
      return value;
    }

    function showErrorModal(message, title = 'Error') {
      const overlay = document.getElementById('error-overlay');
      const msgEl = document.getElementById('error-message');
      const titleEl = document.getElementById('error-title');
      if (!overlay || !msgEl || !titleEl) {
        window.console.error(title + ': ' + message);
        return;
      }
      titleEl.textContent = title;
      msgEl.textContent = String(message || 'Unknown error');
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    }

    function hideErrorModal() {
      const overlay = document.getElementById('error-overlay');
      if (!overlay) return;
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }

    function applyContactSummaryOverride() {
      if (radioAll.checked) {
        summaryText.textContent = `All Students - ${studentContacts.length} students`;
        return;
      }

      if (radioGrade.checked) {
        const grade = gradeDropdown.value;
        const section = sectionDropdown.value;
        if (!grade || !section) return;

        const studentsInSelection = section === 'all'
          ? studentContacts.filter(c => c.grade === grade)
          : studentContacts.filter(c => c.grade === grade && c.section === section);

        const sectionLabel = section === 'all'
          ? 'ALL'
          : (sectionDropdown.options[sectionDropdown.selectedIndex]?.text || section.toUpperCase());

        summaryText.textContent = `Gr${grade} ${sectionLabel} - ${studentsInSelection.length} students`;
      }
    }

    function updateSummary() {
      const manageBtn = document.getElementById('manage-contacts-btn');
      
      if (radioAll.checked) {
        summaryText.textContent = 'All Senior High School Students Selected';
        manageBtn.style.display = 'inline-block';
      } else if (radioGrade.checked) {
        const grade = gradeDropdown.value;
        const section = sectionDropdown.value;
        
        if (!grade) {
          summaryText.textContent = 'Please select a grade level';
          manageBtn.style.display = 'inline-block';
        } else if (!section) {
          summaryText.textContent = `Grade ${grade} - Please select a section`;
          manageBtn.style.display = 'inline-block';
        } else if (section === 'all') {
          summaryText.textContent = `All Grade ${grade} Students Selected`;
          manageBtn.style.display = 'inline-block';
        } else {
          const sectionText = sectionDropdown.options[sectionDropdown.selectedIndex].text;
          summaryText.textContent = `Grade ${grade} - ${sectionText} Selected`;
          manageBtn.style.display = 'inline-block';
        }
      }

      applyContactSummaryOverride();
      updateCreateButtonsDisabledState();
    }

// Character count functionality
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('char-count');
    const MAX_MESSAGE_LENGTH = 5000;

    function updateCharCount() {
      const length = messageInput.value.length;
      charCount.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;

      if (length >= MAX_MESSAGE_LENGTH) {
        charCount.style.color = '#ef4444';
      } else if (length > 160) {
        charCount.style.color = '#f59e0b';
      } else {
        charCount.style.color = '#64748b';
      }
    }
    
    messageInput.addEventListener('input', () => {
      if (messageInput.value.length > MAX_MESSAGE_LENGTH) {
        messageInput.value = messageInput.value.slice(0, MAX_MESSAGE_LENGTH);
      }
      updateCharCount();
    });

    let messageTemplates = [];

    function saveMessageTemplates() {
      try {
        localStorage.setItem(MESSAGE_TEMPLATES_KEY, JSON.stringify(messageTemplates));
      } catch (err) {
        console.warn('Failed to save templates', err);
      }
    }

    function loadMessageTemplates() {
      try {
        const raw = localStorage.getItem(MESSAGE_TEMPLATES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        messageTemplates = Array.isArray(parsed) ? parsed.filter(t => t && t.id && t.name).slice(0, 40) : [];
      } catch (_) {
        messageTemplates = [];
      }
      if (messageTemplates.length === 0) {
        messageTemplates = [
          { id: 'tpl-announcement', name: 'General Announcement', text: 'Good day! This is an announcement from Taal High School. Please take note of the following details: ' },
          { id: 'tpl-reminder', name: 'Reminder', text: 'Good day! Friendly reminder regarding: ' }
        ];
        saveMessageTemplates();
      }
    }

    function renderTemplateSelect() {
      const select = document.getElementById('template-select');
      if (!select) return;
      select.innerHTML = ['<option value="">Select a template...</option>', ...messageTemplates
        .map((template) => `<option value="${template.id}">${template.name}</option>`)]
        .join('');
    }

    function getSelectedTemplate() {
      const select = document.getElementById('template-select');
      if (!select) return null;
      if (!select.value) return null;
      return messageTemplates.find(t => t.id === select.value) || null;
    }

    function initTemplateFeature() {
      const toggleBtn = document.getElementById('message-template-btn');
      const overlay = document.getElementById('template-overlay');
      const backdrop = document.getElementById('template-backdrop');
      const closeBtn = document.getElementById('close-template-btn');
      const saveBtn = document.getElementById('template-save-btn');
      const updateBtn = document.getElementById('template-update-btn');
      const deleteBtn = document.getElementById('template-delete-btn');
      const applyBtn = document.getElementById('template-apply-btn');
      const nameInput = document.getElementById('template-name-input');
      const bodyInput = document.getElementById('template-body-input');
      const select = document.getElementById('template-select');
      if (!toggleBtn || !overlay || !backdrop || !closeBtn || !saveBtn || !updateBtn || !deleteBtn || !applyBtn || !nameInput || !bodyInput || !select) return;

      loadMessageTemplates();
      renderTemplateSelect();

      const fillInputsFromSelected = () => {
        const template = getSelectedTemplate();
        nameInput.value = template ? template.name : '';
        bodyInput.value = template ? (template.text || '') : '';
      };

      const openOverlay = () => {
        overlay.classList.remove('hidden');
        fillInputsFromSelected();
      };

      const closeOverlay = () => {
        overlay.classList.add('hidden');
      };

      toggleBtn.addEventListener('click', () => {
        openOverlay();
      });
      closeBtn.addEventListener('click', closeOverlay);
      backdrop.addEventListener('click', closeOverlay);

      select.addEventListener('change', () => {
        fillInputsFromSelected();
      });

      applyBtn.addEventListener('click', () => {
        const template = getSelectedTemplate();
        if (!template) return;
        messageInput.value = template.text || '';
        updateCharCount();
        closeOverlay();
      });

      saveBtn.addEventListener('click', () => {
        const name = String(nameInput.value || '').trim();
        const text = String(bodyInput.value || '').trim();
        if (!name || !text) {
          alert('Enter a template name and message content first.');
          return;
        }
        messageTemplates.unshift({
          id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          text
        });
        if (messageTemplates.length > 40) {
          messageTemplates = messageTemplates.slice(0, 40);
        }
        saveMessageTemplates();
        renderTemplateSelect();
        if (select.options.length > 0) {
          select.selectedIndex = 0;
        }
        nameInput.value = '';
        bodyInput.value = '';
      });

      updateBtn.addEventListener('click', () => {
        const template = getSelectedTemplate();
        if (!template) return;
        const name = String(nameInput.value || '').trim();
        const text = String(bodyInput.value || '').trim();
        if (!name || !text) {
          alert('Template name and message content are required.');
          return;
        }
        template.name = name;
        template.text = text;
        saveMessageTemplates();
        renderTemplateSelect();
        select.value = template.id;
        fillInputsFromSelected();
      });

      deleteBtn.addEventListener('click', () => {
        const template = getSelectedTemplate();
        if (!template) return;
        if (!confirm(`Delete template \"${template.name}\"?`)) return;
        messageTemplates = messageTemplates.filter(t => t.id !== template.id);
        saveMessageTemplates();
        renderTemplateSelect();
        fillInputsFromSelected();
      });

      fillInputsFromSelected();
    }

    updateCharCount();

// Send button simulation
    const sendBtn = document.getElementById('send-btn');
    sendBtn.addEventListener('click', async () => {
      const message = messageInput.value.trim();
      if (!message) {
        alert('Please type a message before sending.');
        return;
      }

      let recipients = getSelectedContacts();
      if (recipients.length === 0 && radioAll.checked) {
        recipients = getAllContacts();
      }
      if (recipients.length === 0 && radioGrade.checked) {
        recipients = filterContactsBySelection(getAllContacts());
      }

      if (recipients.length === 0) {
        alert('Please add contacts and select at least one recipient.');
        showContactList();
        return;
      }

      const phones = recipients
        .map(c => normalizePhone(c.phone))
        .filter(p => p.length >= 7);

      if (phones.length === 0) {
        alert('No valid phone numbers found in selected contacts.');
        showContactList();
        return;
      }

      const recipientLabel = formatRecipientsLabel(recipients, `${phones.length} recipients`);
      const preview = message.length > 140 ? `${message.slice(0, 140)}...` : message;
      const confirmed = confirm(
        `Send this message to ${phones.length} recipient(s)?\n\nTo: ${recipientLabel}\n\nMessage:\n${preview}`
      );
      if (!confirmed) {
        return;
      }

      const originalContent = sendBtn.innerHTML;
      sendBtn.innerHTML = `
        <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        Sending...
      `;
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.7';
      
      try {
        // GSM sending can take longer per recipient (retries, modem delays).
        // Keep the browser request alive longer to avoid premature AbortError.
        const requestTimeoutMs = Math.max(180000, phones.length * 120000);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
        const res = await fetch('/sms/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones, message }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          const fallback = await res.text().catch(() => '');
          throw new Error(
            'Server returned non-JSON response (HTTP ' + res.status + '). ' +
            (fallback ? fallback.slice(0, 160) : 'No response body.')
          );
        }
        if (!res.ok || !data.ok) {
          const failedResults = Array.isArray(data.results)
            ? data.results.filter(r => !r.ok)
            : [];
          const firstFailureError = failedResults[0]?.error;
          throw new Error(firstFailureError || data.error || 'Failed to send messages');
        }

        const results = Array.isArray(data.results) ? data.results : [];
        const successCount = results.length > 0
          ? results.filter(r => r.ok).length
          : phones.length;
        const failedCount = results.length > 0
          ? (results.length - successCount)
          : 0;

        if (successCount === 0) {
          throw new Error('All messages failed to send');
        }

        sendBtn.innerHTML = originalContent;
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        
        // Update stats
        const totalEl = document.getElementById('stat-total');
        const deliveredEl = document.getElementById('stat-delivered');
        const failedEl = document.getElementById('stat-failed');
        totalEl.textContent = parseInt(totalEl.textContent) + phones.length;
        deliveredEl.textContent = parseInt(deliveredEl.textContent) + successCount;
        if (failedEl) {
          failedEl.textContent = parseInt(failedEl.textContent) + failedCount;
        }
        
        // Add new log entry
        addLogEntry('delivered', '', {
          recipients,
          message,
          timestamp: new Date(),
          stats: {
            successCount,
            failedCount,
            totalCount: phones.length
          }
        });
        logActivity(
          getCurrentUserName(),
          getCurrentUserRole(),
          `Sent SMS to ${formatRecipientsLabel(recipients, `${phones.length} recipients`)}`,
          { type: 'other' }
        );
        if (failedCount > 0) {
          alert(`Sent ${successCount}/${phones.length}. Failed: ${failedCount}.`);
        }
      } catch (err) {
        sendBtn.innerHTML = originalContent;
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';

        const totalEl = document.getElementById('stat-total');
        const failedEl = document.getElementById('stat-failed');
        if (totalEl) {
          const currentTotal = parseInt(totalEl.textContent || '0', 10) || 0;
          totalEl.textContent = currentTotal + phones.length;
        }
        if (failedEl) {
          const currentFailed = parseInt(failedEl.textContent || '0', 10) || 0;
          failedEl.textContent = currentFailed + phones.length;
        }

        const rawError = String(err && err.message ? err.message : '');
        const rawErrorLower = rawError.toLowerCase();
        const logOptions = {
          recipients,
          message,
          timestamp: new Date()
        };
        const wasAborted =
          err.name === 'AbortError' ||
          rawErrorLower.includes('aborted') ||
          rawErrorLower.includes('abort');
        const looksLikeModemOrLoadIssue =
          rawErrorLower.includes('modem') ||
          rawErrorLower.includes('gsm') ||
          rawErrorLower.includes('no modem response') ||
          rawErrorLower.includes('balance') ||
          rawErrorLower.includes('load');

        const shortReason = rawError || 'Unknown modem error';
        if (wasAborted) {
          addLogEntry('failed', 'Timed out waiting for modem response.', logOptions);
          alert(`Send timed out. Reason: ${shortReason}`);
        } else if (looksLikeModemOrLoadIssue) {
          addLogEntry('failed', 'Modem/SIM not ready (connection or balance/load issue).', logOptions);
          alert(`Send failed. Reason: ${shortReason}`);
        } else {
          addLogEntry('failed', rawError || 'Failed to send messages.', logOptions);
          alert(`Send failed. Reason: ${shortReason}`);
        }
      }
    });

    // Add log entry function
    function formatRecipientsLabel(recipients, fallback = 'Recipients') {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return fallback;
      }
      const labels = recipients.map(r => {
        const name = (r && r.name ? String(r.name) : '').trim();
        if (name) return name;
        return (r && r.phone ? String(r.phone) : '').trim() || 'Unknown';
      }).filter(Boolean);
      if (labels.length === 0) {
        return `${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`;
      }
      const unique = [...new Set(labels)];
      if (unique.length > 4) {
        return `${unique.slice(0, 3).join(', ')} +${unique.length - 3} more`;
      }
      return unique.join(', ');
    }

    function formatTimestampLabel(date) {
      const target = new Date(date || Date.now());
      return target.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    let messageLogEntries = [];
    let messageLogSelectionMode = false;
    const selectedMessageLogIds = new Set();

    function escapeLogHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function persistMessageLog() {
      try {
        localStorage.setItem(MESSAGE_LOG_KEY, JSON.stringify(messageLogEntries));
      } catch (err) {
        console.warn('Failed to save message log', err);
      }
    }

    function loadMessageLogFromStorage() {
      try {
        const raw = localStorage.getItem(MESSAGE_LOG_KEY);
        if (!raw) {
          messageLogEntries = [];
          return;
        }
        const parsed = JSON.parse(raw);
        messageLogEntries = Array.isArray(parsed)
          ? parsed.filter((entry) => entry && (entry.status === 'delivered' || entry.status === 'failed'))
          : [];
      } catch (err) {
        console.warn('Failed to load message log', err);
        messageLogEntries = [];
      }
    }

    function updateStatsFromMessageLog() {
      const totalEl = document.getElementById('stat-total');
      const deliveredEl = document.getElementById('stat-delivered');
      const failedEl = document.getElementById('stat-failed');
      if (!totalEl || !deliveredEl || !failedEl) return;

      const totals = messageLogEntries.reduce((acc, entry) => {
        const stats = entry.stats || {};
        const totalCount = Number.isFinite(stats.totalCount) ? stats.totalCount : 1;
        const successCount = Number.isFinite(stats.successCount) ? stats.successCount : (entry.status === 'delivered' ? totalCount : 0);
        const failedCount = Number.isFinite(stats.failedCount) ? stats.failedCount : (entry.status === 'failed' ? totalCount : 0);
        acc.total += Math.max(totalCount, 0);
        acc.delivered += Math.max(successCount, 0);
        acc.failed += Math.max(failedCount, 0);
        return acc;
      }, { total: 0, delivered: 0, failed: 0 });

      totalEl.textContent = String(totals.total);
      deliveredEl.textContent = String(totals.delivered);
      failedEl.textContent = String(totals.failed);
    }

    function buildMessageLogElement(entryData) {
      const isFailed = entryData.status === 'failed';
      const cardBg = isFailed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)';
      const cardBorder = isFailed ? '#ef4444' : '#22c55e';
      const iconBg = isFailed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
      const iconColor = isFailed ? '#ef4444' : '#22c55e';
      const statusBg = isFailed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
      const statusText = isFailed ? 'Failed' : 'Delivered';

      const recipients = Array.isArray(entryData.recipients) ? entryData.recipients : [];
      const recipientInfo = formatRecipientsLabel(recipients, summaryText.textContent || 'All Students');
      const timestamp = Number(entryData.timestamp) || Date.now();
      const timeLabel = formatTimestampLabel(timestamp);
      const stats = entryData.stats || {};
      const rawMessage = entryData.message || '';
      const trimmedMessage = String(rawMessage).trim().substring(0, 120);
      const statsHint = !isFailed && stats.totalCount
        ? ` (${Math.max(stats.successCount || 0, 0)}/${stats.totalCount} delivered${stats.failedCount ? `, ${stats.failedCount} failed` : ''})`
        : '';
      const previewText = isFailed
        ? (entryData.failureReason || 'Message failed to send.')
        : `${trimmedMessage}${statsHint}`.trim() || 'Message sent';

      const entry = document.createElement('div');
      entry.className = 'flex items-start gap-3 p-3 rounded-lg fade-in';
      entry.style.cssText = `background: ${cardBg}; border-left: 3px solid ${cardBorder};`;
      entry.setAttribute('data-status', entryData.status);
      entry.setAttribute('data-log-id', entryData.id);
      const checked = selectedMessageLogIds.has(entryData.id);

      entry.innerHTML = `
        ${messageLogSelectionMode ? `<input type="checkbox" class="log-select-checkbox mt-1" data-log-id="${escapeLogHtml(entryData.id)}" ${checked ? 'checked' : ''}>` : ''}
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${iconBg};">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2">
            ${isFailed
              ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
              : '<polyline points="20 6 9 17 4 12"/>'}
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1 gap-3">
            <span class="text-sm font-medium truncate" style="color: #0F0F0F;">${escapeLogHtml(recipientInfo)}</span>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" style="color: #374151;">${escapeLogHtml(timeLabel)}</span>
            </div>
          </div>
          <p class="text-xs truncate" style="color: #374151;">${escapeLogHtml(previewText)}</p>
          <span class="inline-block mt-1 px-2 py-0.5 rounded text-xs" style="background: ${statusBg}; color: ${iconColor};">${statusText}</span>
        </div>
      `;
      return entry;
    }

    function updateMessageLogActionButtons() {
      const selectBtn = document.getElementById('select-log-btn');
      const deleteBtn = document.getElementById('delete-log-btn');
      if (!selectBtn || !deleteBtn) return;
      selectBtn.textContent = messageLogSelectionMode ? 'Cancel' : 'Select';
      deleteBtn.disabled = !messageLogSelectionMode || selectedMessageLogIds.size === 0;
      deleteBtn.textContent = selectedMessageLogIds.size > 0 ? `Delete (${selectedMessageLogIds.size})` : 'Delete';
      deleteBtn.style.opacity = deleteBtn.disabled ? '0.55' : '1';
      deleteBtn.style.cursor = deleteBtn.disabled ? 'not-allowed' : 'pointer';
    }

    function renderMessageLogEntries() {
      const log = document.getElementById('message-log');
      if (!log) return;
      log.innerHTML = '';
      messageLogEntries.forEach((entryData) => {
        log.appendChild(buildMessageLogElement(entryData));
      });
      updateStatsFromMessageLog();
      filterMessages(currentFilter);
      updateMessageLogActionButtons();
    }

    function addLogEntry(status = 'delivered', failureReason = '', options = {}) {
      const recipients = Array.isArray(options.recipients) ? options.recipients : [];
      const rawMessage = options.message || messageInput.value || '';
      const timestamp = options.timestamp ? new Date(options.timestamp).getTime() : Date.now();
      const entryData = {
        id: `log-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        status: status === 'failed' ? 'failed' : 'delivered',
        failureReason: String(failureReason || ''),
        recipients: recipients.map((r) => ({
          name: r && r.name ? String(r.name) : '',
          phone: r && r.phone ? String(r.phone) : ''
        })),
        message: String(rawMessage || ''),
        timestamp,
        stats: options.stats || null
      };
      messageLogEntries.unshift(entryData);
      if (messageLogEntries.length > MESSAGE_LOG_MAX_ITEMS) {
        messageLogEntries = messageLogEntries.slice(0, MESSAGE_LOG_MAX_ITEMS);
      }
      persistMessageLog();
      renderMessageLogEntries();
    }

// Message filtering functionality
    let currentFilter = 'all';

    function filterMessages(status) {
      currentFilter = status;
      const allMessages = document.querySelectorAll('#message-log > div[data-status]');
      
      allMessages.forEach(message => {
        if (status === 'all' || message.getAttribute('data-status') === status) {
          message.style.display = 'flex';
        } else {
          message.style.display = 'none';
        }
      });
    }

    // Add click handlers for filters
    document.getElementById('filter-total').addEventListener('click', () => filterMessages('all'));
    document.getElementById('filter-delivered').addEventListener('click', () => filterMessages('delivered'));
    document.getElementById('filter-failed').addEventListener('click', () => filterMessages('failed'));
    document.getElementById('select-log-btn').addEventListener('click', () => {
      messageLogSelectionMode = !messageLogSelectionMode;
      if (!messageLogSelectionMode) {
        selectedMessageLogIds.clear();
      }
      renderMessageLogEntries();
    });
    document.getElementById('delete-log-btn').addEventListener('click', () => {
      if (!messageLogSelectionMode || selectedMessageLogIds.size === 0) return;
      if (!confirm(`Delete ${selectedMessageLogIds.size} selected log item(s)?`)) return;
      messageLogEntries = messageLogEntries.filter((entry) => !selectedMessageLogIds.has(entry.id));
      selectedMessageLogIds.clear();
      persistMessageLog();
      renderMessageLogEntries();
    });
    document.getElementById('message-log').addEventListener('click', (e) => {
      const checkbox = e.target ? e.target.closest('.log-select-checkbox') : null;
      if (!checkbox) return;
      const id = checkbox.getAttribute('data-log-id');
      if (!id) return;
      if (checkbox.checked) {
        selectedMessageLogIds.add(id);
      } else {
        selectedMessageLogIds.delete(id);
      }
      updateMessageLogActionButtons();
    });

    // Contact Management
    let currentContactType = '';
    let activeManageTab = 'students';
    let currentView = 'messageLog'; // Track current view state
    const studentsColumn = document.getElementById('students-column');
    const parentsColumn = document.getElementById('parents-column');
    const studentActions = document.getElementById('student-actions');
    const parentActions = document.getElementById('parent-actions');
    const studentsTabBtn = document.getElementById('manage-tab-students');
    const parentsTabBtn = document.getElementById('manage-tab-parents');

    function setManageTab(tab) {
      activeManageTab = tab;
      const showStudents = tab === 'students';
      const tabRow = document.getElementById('manage-tab-row');
      const studentsControls = document.getElementById('students-header-controls');
      const parentsControls = document.getElementById('parents-header-controls');

      if (studentsColumn) studentsColumn.style.display = showStudents ? 'flex' : 'none';
      if (parentsColumn) parentsColumn.style.display = showStudents ? 'none' : 'flex';
      if (studentActions) studentActions.style.display = showStudents ? 'flex' : 'none';
      if (parentActions) parentActions.style.display = showStudents ? 'none' : 'flex';

      if (studentsTabBtn) studentsTabBtn.classList.toggle('active', showStudents);
      if (parentsTabBtn) parentsTabBtn.classList.toggle('active', !showStudents);

      if (tabRow) {
        tabRow.style.marginRight = '8px';
        if (showStudents && studentsControls) {
          studentsControls.insertBefore(tabRow, studentsControls.firstChild);
        } else if (!showStudents && parentsControls) {
          parentsControls.insertBefore(tabRow, parentsControls.firstChild);
          tabRow.style.marginRight = '12px';
        }
      }
    }

    function createNormalizedContact(raw) {
      return {
        id: raw.id || `contact-${Date.now()}-${Math.random()}`.replace('0.', ''),
        name: String(raw.name || ''),
        phone: toLocalDisplayPhone(raw.phone || ''),
        grade: String(raw.grade || ''),
        section: String(raw.section || ''),
        selected: false,
        showPhone: false,
        editMode: '',
        showPen: false
      };
    }

    function createStoragePayload() {
      const sanitize = (list) => list.map(contact => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        grade: contact.grade,
        section: contact.section
      }));
      return {
        students: sanitize(studentContacts),
        parents: sanitize(parentContacts)
      };
    }

    function applyContactsData(payload = {}) {
      const students = Array.isArray(payload.students) ? payload.students : [];
      const parents = Array.isArray(payload.parents) ? payload.parents : [];
      studentContacts.length = 0;
      parentContacts.length = 0;
      students.forEach(contact => studentContacts.push(createNormalizedContact(contact)));
      parents.forEach(contact => parentContacts.push(createNormalizedContact(contact)));
    }

    async function pushContactsToFirebase(payload) {
      const provider = window.firebaseContacts;
      if (!provider || typeof provider.saveContacts !== 'function') return;
      try {
        if (provider.ready) {
          await Promise.resolve(provider.ready);
        }
        await provider.saveContacts(payload);
      } catch (err) {
        console.warn('Failed to sync contacts to Firebase', err);
      }
    }

    async function loadRemoteContacts() {
      const provider = window.firebaseContacts;
      if (!provider || typeof provider.fetchContacts !== 'function') {
        return false;
      }

      try {
        if (provider.ready) {
          await Promise.resolve(provider.ready);
        }
        const payload = await provider.fetchContacts();
        if (!payload || (!Array.isArray(payload.students) && !Array.isArray(payload.parents))) {
          return false;
        }
        applyContactsData(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(createStoragePayload()));
        return true;
      } catch (err) {
        console.warn('Failed to load contacts from Firebase', err);
        return false;
      }
    }

    function saveContacts() {
      const payload = createStoragePayload();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      pushContactsToFirebase(payload);
    }

    async function loadContacts() {
      const loadedRemote = await loadRemoteContacts();
      if (loadedRemote) {
        return;
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        applyContactsData(data);
      } catch (e) {
        console.warn('Failed to load contacts from storage', e);
      }
    }

    // View switching system - preserves DOM, only toggles visibility
    function showMessageLog() {
      currentView = 'messageLog';
      const contactListView = document.getElementById('contact-list-view');
      
      if (contactListView) {
        contactListView.style.display = 'none';
      }
      
      console.log('Showing Message Log');
    }

    function showContactList() {
      currentView = 'contactList';
      const contactListView = document.getElementById('contact-list-view');
      
      if (contactListView) {
        contactListView.style.display = 'flex';
      }
      
      console.log('Showing Contact List');
      setManageTab(activeManageTab);
      renderContacts();
    }

    // Toggle between Message Log and Contact List - using event delegation
    document.addEventListener('click', (e) => {
      // Check if the clicked element is the manage contacts button
      const manageBtn = e.target ? e.target.closest('#manage-contacts-btn') : null;
      if (manageBtn) {
        e.preventDefault();
        console.log('Manage Contacts button clicked');
        showContactList();
      }
      
      // Check if the clicked element is the close contacts button
      const closeBtn = e.target ? e.target.closest('#close-contacts-btn') : null;
      if (closeBtn) {
        e.preventDefault();
        console.log('Close Contacts button clicked');
        showMessageLog();
      }
    });

    if (studentsTabBtn) {
      studentsTabBtn.addEventListener('click', () => {
        setManageTab('students');
      });
    }

    if (parentsTabBtn) {
      parentsTabBtn.addEventListener('click', () => {
        setManageTab('parents');
      });
    }

    // Add contact handlers
    document.getElementById('add-student-btn').addEventListener('click', () => {
      if (!canCreateContactsInCurrentSelection()) return;
      currentContactType = 'student';
      document.getElementById('form-title').textContent = 'Add Student';
      document.getElementById('contact-name-input').value = '';
      document.getElementById('contact-phone-input').value = '';
      if (radioGrade.checked && gradeDropdown.value && sectionDropdown.value && sectionDropdown.value !== 'all') {
        contactGradeInput.value = gradeDropdown.value;
        updateContactSectionOptions(gradeDropdown.value);
        contactSectionInput.value = sectionDropdown.value;
        contactGradeInput.disabled = true;
        contactSectionInput.disabled = true;
      } else {
        contactGradeInput.value = '';
        updateContactSectionOptions('');
        contactSectionInput.value = '';
        contactGradeInput.disabled = false;
        contactSectionInput.disabled = false;
      }
      document.getElementById('add-contact-form').style.display = 'block';
    });

    document.getElementById('add-parent-btn').addEventListener('click', () => {
      if (!canCreateContactsInCurrentSelection()) return;
      currentContactType = 'parent';
      document.getElementById('form-title').textContent = 'Add Parent';
      document.getElementById('contact-name-input').value = '';
      document.getElementById('contact-phone-input').value = '';
      if (radioGrade.checked && gradeDropdown.value && sectionDropdown.value && sectionDropdown.value !== 'all') {
        contactGradeInput.value = gradeDropdown.value;
        updateContactSectionOptions(gradeDropdown.value);
        contactSectionInput.value = sectionDropdown.value;
        contactGradeInput.disabled = true;
        contactSectionInput.disabled = true;
      } else {
        contactGradeInput.value = '';
        updateContactSectionOptions('');
        contactSectionInput.value = '';
        contactGradeInput.disabled = false;
        contactSectionInput.disabled = false;
      }
      document.getElementById('add-contact-form').style.display = 'block';
    });

    document.getElementById('cancel-contact-btn').addEventListener('click', () => {
      contactGradeInput.disabled = false;
      contactSectionInput.disabled = false;
      document.getElementById('add-contact-form').style.display = 'none';
    });

    contactGradeInput.addEventListener('change', () => {
      updateContactSectionOptions(contactGradeInput.value);
    });

    document.getElementById('save-contact-btn').addEventListener('click', () => {
      const name = document.getElementById('contact-name-input').value.trim();
      const phone = document.getElementById('contact-phone-input').value.trim();
      const grade = contactGradeInput.value || gradeDropdown.value || '';
      const section = contactSectionInput.value || sectionDropdown.value || '';
      
      if (!name || !phone) {
        return;
      }
      if (!grade || !section || section === 'all') {
        alert('Please choose a specific grade and section before creating a contact.');
        return;
      }
      
      const contact = {
        id: Date.now().toString(),
        name,
        phone,
        grade,
        section,
        selected: false,
        showPhone: false,
        editMode: '',
        showPen: false
      };
      
      if (currentContactType === 'student') {
        studentContacts.push(contact);
      } else {
        parentContacts.push(contact);
      }

      contactGradeInput.disabled = false;
      contactSectionInput.disabled = false;
      document.getElementById('add-contact-form').style.display = 'none';
      saveContacts();
      renderContacts();
    });

    // Delete selected contacts
    document.getElementById('delete-student-btn').addEventListener('click', () => {
      for (let i = studentContacts.length - 1; i >= 0; i--) {
        if (studentContacts[i].selected) {
          studentContacts.splice(i, 1);
        }
      }
      saveContacts();
      renderContacts();
    });

    document.getElementById('delete-parent-btn').addEventListener('click', () => {
      for (let i = parentContacts.length - 1; i >= 0; i--) {
        if (parentContacts[i].selected) {
          parentContacts.splice(i, 1);
        }
      }
      saveContacts();
      renderContacts();
    });

    // Load contacts from file
    function selectAllVisibleContacts(type) {
      const source = type === 'student' ? studentContacts : parentContacts;
      const visible = filterContactsForView(source);
      if (visible.length === 0) return;
      visible.forEach(contact => {
        contact.selected = true;
      });
      renderContacts();
    }

    document.getElementById('load-students-btn').addEventListener('click', () => {
      loadContactsFromFile('student');
    });

    document.getElementById('load-parents-btn').addEventListener('click', () => {
      loadContactsFromFile('parent');
    });

    document.getElementById('select-all-students-btn').addEventListener('click', () => {
      selectAllVisibleContacts('student');
    });

    document.getElementById('select-all-parents-btn').addEventListener('click', () => {
      selectAllVisibleContacts('parent');
    });

    function parseContactLine(line, fallbackName) {
      const cleaned = String(line || '').trim().replace(/^\[/, '').replace(/\]$/, '').trim();
      if (!cleaned) return null;
      const lower = cleaned.toLowerCase();
      if (lower === 'name,phone' || lower === 'name;phone' || lower === 'name|phone') {
        return null;
      }

      let name = '';
      let phone = '';

      // Supports:
      // - James = 09123456789
      // - James,09123456789
      // - James|09123456789
      // - 09123456789
      const separators = ['=', ',', ';', '|', '\t'];
      const separator = separators.find(sep => cleaned.includes(sep));

      if (separator) {
        const parts = cleaned.split(separator);
        name = (parts[0] || '').trim();
        phone = parts.slice(1).join(separator).trim();
      } else {
        phone = cleaned;
      }

      const originalPhone = String(phone || cleaned)
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .replace(/\s+/g, '')
        .replace(/[-()]/g, '');
      const normalizedPhone = normalizePhone(originalPhone);
      if (!normalizedPhone || normalizedPhone.length < 7) return null;

      return {
        name: name || `Contact ${fallbackName}`,
        phone: originalPhone
      };
    }

    function loadContactsFromFile(type) {
      if (!canCreateContactsInCurrentSelection()) {
        alert('Select a grade and a specific section first before importing contacts.');
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.csv';
      
      input.onchange = (e) => {
        const file = e && e.target && e.target.files ? e.target.files[0] : null;
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const text = String((event && event.target && event.target.result) || '');
            const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

            const selectedGrade = radioGrade.checked ? gradeDropdown.value : '';
            const selectedSection =
              radioGrade.checked && sectionDropdown.value && sectionDropdown.value !== 'all'
                ? sectionDropdown.value
                : '';

            let importedCount = 0;

            lines.forEach((line, index) => {
              const parsed = parseContactLine(line, (Date.now() + index).toString().slice(-4));
              if (!parsed) return;

              const contact = {
                id: Date.now().toString() + Math.random(),
                name: parsed.name,
                phone: parsed.phone,
                grade: selectedGrade || '',
                section: selectedSection || '',
                selected: false,
                showPhone: false,
                editMode: '',
                showPen: false
              };

              if (type === 'student') {
                studentContacts.push(contact);
              } else {
                parentContacts.push(contact);
              }

              importedCount += 1;
            });

            renderContacts();
            saveContacts();
            if (importedCount === 0) {
              alert('No valid contacts found in the file. Use format: Name,09123456789');
            } else {
              alert(`Imported ${importedCount} contact(s).`);
            }
          } catch (err) {
            alert(`Import failed: ${(err && err.message) || 'Unknown file error'}`);
          }
        };
        reader.onerror = () => {
          alert('Failed to read selected file.');
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    }

    // Render contacts
    function getContactFilterState() {
      if (!radioGrade.checked) {
        return { mode: 'all' };
      }

      const grade = gradeDropdown.value;
      const section = sectionDropdown.value;
      if (!grade || !section) {
        return { mode: 'none' };
      }

      if (section === 'all') {
        return { mode: 'grade', grade };
      }

      return { mode: 'section', grade, section };
    }

    function filterContactsForView(contacts) {
      const state = getContactFilterState();
      if (state.mode === 'all') return contacts;
      if (state.mode === 'none') return [];
      if (state.mode === 'grade') {
        return contacts.filter(c => c.grade === state.grade);
      }
      return contacts.filter(c => c.grade === state.grade && c.section === state.section);
    }

    function renderContacts() {
      const studentsList = document.getElementById('students-list');
      const parentsList = document.getElementById('parents-list');
      
      studentsList.innerHTML = '';
      parentsList.innerHTML = '';

      const visibleStudents = filterContactsForView(studentContacts);
      const visibleParents = filterContactsForView(parentContacts);

      visibleStudents.forEach(contact => {
        const el = createContactElement(contact, 'student');
        studentsList.appendChild(el);
      });
      
      visibleParents.forEach(contact => {
        const el = createContactElement(contact, 'parent');
        parentsList.appendChild(el);
      });

      updateSummary();
    }

    function createContactElement(contact, type) {
      const div = document.createElement('div');
      div.className = 'p-3 mb-2 rounded-lg transition-all cursor-pointer';
      div.style.cssText = `
        background: ${contact.selected ? 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' : '#ffffff'};
        border: 1px solid ${contact.selected ? '#2563EB' : '#BFDBFE'};
        box-shadow: ${contact.selected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'};
      `;
      div.style.position = 'relative';
      contact.editMode = contact.editMode || '';
      contact.showPen = !!contact.showPen;
      const openPhoneEditor = () => {
        contact.showPhone = true;
        contact.editMode = 'phone';
        contact.showPen = true;
        renderContacts();
      };
      const openNameEditor = () => {
        contact.showPhone = true;
        contact.editMode = 'name';
        contact.showPen = true;
        renderContacts();
      };
      // Hover effect
      div.addEventListener('mouseenter', () => {
        if (!contact.selected) {
          div.style.background = '#EFF6FF';
          div.style.transform = 'translateX(4px)';
        }
      });
      div.addEventListener('mouseleave', () => {
        if (!contact.selected) {
          div.style.background = '#ffffff';
          div.style.transform = 'translateX(0)';
        }
      });

      const topRow = document.createElement('div');
      topRow.className = 'flex items-center gap-1.5';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'text-sm font-semibold block';
      nameSpan.style.color = '#1f2937';
      nameSpan.textContent = contact.name;
      topRow.appendChild(nameSpan);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'w-6 h-6 rounded-md flex items-center justify-center';
      editBtn.style.cssText = 'background:#EFF6FF;border:1px solid #BFDBFE;color:#1E3A8A;';
      editBtn.setAttribute('aria-label', 'Edit contact');
      editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';
      editBtn.style.opacity = contact.showPen ? '1' : '0';
      editBtn.style.pointerEvents = contact.showPen ? 'auto' : 'none';
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!contact.showPhone) {
          openNameEditor();
          return;
        }
        if (contact.editMode === 'phone') {
          openNameEditor();
        } else {
          openPhoneEditor();
        }
      });
      topRow.appendChild(editBtn);
      div.appendChild(topRow);

      if (contact.grade || contact.section) {
        const metaSpan = document.createElement('span');
        metaSpan.className = 'text-xs block mt-1';
        metaSpan.style.color = '#374151';
        const sectionLabel = getSectionLabel(contact.grade, contact.section);
        metaSpan.textContent = `${contact.grade ? 'G' + contact.grade : ''}${contact.grade && contact.section ? ' - ' : ''}${sectionLabel}`;
        div.appendChild(metaSpan);
      }
      
      if (contact.showPhone) {
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = contact.editMode === 'name' ? contact.name : contact.phone;
        inputEl.className = 'w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium';
        inputEl.style.cssText = 'background: #ffffff; border: 1px solid #93C5FD; color: #0F0F0F; transition: all 0.2s;';
        inputEl.onclick = (e) => e.stopPropagation();
        inputEl.onfocus = function() {
          this.style.borderColor = '#2563EB';
          this.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
        };
        inputEl.onblur = function() {
          this.style.borderColor = '#93C5FD';
          this.style.boxShadow = 'none';
        };
        div.appendChild(inputEl);

        const saveEditBtn = document.createElement('button');
        saveEditBtn.type = 'button';
        saveEditBtn.className = 'mt-2 px-3 py-1.5 rounded text-xs font-semibold';
        saveEditBtn.style.cssText = 'background:#2563EB;color:#ffffff;';
        saveEditBtn.textContent = 'Save';
        saveEditBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const nextValue = String(inputEl.value || '').trim();
          if (!nextValue) {
            alert('Value is required.');
            return;
          }
          if (contact.editMode === 'name') {
            contact.name = nextValue;
          } else {
            contact.phone = nextValue;
          }
          saveContacts();
          renderContacts();
        };
        div.appendChild(saveEditBtn);
      }
      
      // Double click opens phone editor.
      div.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openPhoneEditor();
      });
      
      // Click to select (single), Ctrl+Click for multiple selection
      div.addEventListener('click', (e) => {
        if (contact.editMode === 'phone') {
          contact.showPhone = false;
          contact.editMode = '';
          contact.showPen = false;
          contact.selected = false;
          renderContacts();
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Click: toggle selection (multi-select)
          contact.selected = !contact.selected;
        } else {
          // Regular click: select only this contact (deselect others)
          const contactList = type === 'student' ? studentContacts : parentContacts;
          contactList.forEach(c => {
            c.selected = (c.id === contact.id);
          });
        }
        renderContacts();
      });
      
      return div;
    }

    // Inbox Feature
    const inboxState = {
      isOpen: false,
      isLoading: false,
      selectedConversationId: null,
      query: '',
      selectionMode: false,
      selectedConversationIds: new Set(),
      conversations: []
    };
    let inboxRefreshTimer = null;

    function getLatestInboxMessage(conversation) {
      if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0) {
        return null;
      }
      return conversation.messages[conversation.messages.length - 1];
    }

    function inboxConversationSort(a, b) {
      const aLatest = getLatestInboxMessage(a);
      const bLatest = getLatestInboxMessage(b);
      const aEpoch = aLatest ? aLatest.epoch : 0;
      const bEpoch = bLatest ? bLatest.epoch : 0;
      return bEpoch - aEpoch;
    }

    function getInboxFilteredConversations() {
      const q = (inboxState.query || '').trim().toLowerCase();
      const base = [...inboxState.conversations].sort(inboxConversationSort);
      if (!q) return base;

      return base.filter((conversation) => {
        const name = (conversation.name || '').toLowerCase();
        const phone = (conversation.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    }

    function getInboxConversationById(id) {
      return inboxState.conversations.find(c => c.id === id) || null;
    }

    function getInboxTotalUnread() {
      return inboxState.conversations.reduce((sum, conversation) => sum + (conversation.unread || 0), 0);
    }

    function escapeInboxHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function updateInboxUnreadBadges() {
      const totalUnread = getInboxTotalUnread();
      const menuBadge = document.getElementById('inbox-total-unread');
      const unreadPill = document.getElementById('inbox-unread-pill');
      if (menuBadge) {
        menuBadge.textContent = String(totalUnread);
        menuBadge.classList.toggle('hidden', totalUnread <= 0);
      }
      if (unreadPill) {
        unreadPill.textContent = `${totalUnread} unread`;
        unreadPill.classList.toggle('hidden', totalUnread <= 0);
      }
    }

    function markInboxConversationRead(conversationId) {
      const conversation = getInboxConversationById(conversationId);
      if (!conversation) return;
      conversation.unread = 0;
      updateInboxUnreadBadges();
    }

    function resetInboxSelection() {
      inboxState.selectionMode = false;
      inboxState.selectedConversationIds.clear();
      updateInboxActionButtons();
    }

    function updateInboxActionButtons() {
      const selectBtn = document.getElementById('select-inbox-btn');
      const deleteBtn = document.getElementById('delete-inbox-btn');
      if (!selectBtn || !deleteBtn) return;

      selectBtn.textContent = inboxState.selectionMode ? 'Cancel' : 'Select';
      const selectedCount = inboxState.selectedConversationIds.size;
      deleteBtn.disabled = !inboxState.selectionMode || selectedCount === 0;
      deleteBtn.textContent = selectedCount > 0 ? `Delete (${selectedCount})` : 'Delete';
      deleteBtn.style.opacity = deleteBtn.disabled ? '0.55' : '1';
      deleteBtn.style.cursor = deleteBtn.disabled ? 'not-allowed' : 'pointer';
    }

    async function loadInboxFromServer() {
      try {
        const contactNameByPhone = new Map(
          getAllContacts()
            .map((contact) => {
              const normalized = normalizePhone(contact.phone || '');
              const label = (contact.name || '').trim();
              return [normalized, label];
            })
            .filter(([phone, label]) => phone && label)
        );

        const res = await fetch('/inbox');
        const data = await res.json();
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && data.error) || `HTTP ${res.status}`);
        }
        const serverConversations = Array.isArray(data.conversations) ? data.conversations : [];
        inboxState.conversations = serverConversations.map((conversation) => {
          const normalizedPhone = normalizePhone(conversation.phone || '');
          const matchedName = contactNameByPhone.get(normalizedPhone);
          return {
            ...conversation,
            name: matchedName || conversation.name || conversation.phone
          };
        });
      } catch (err) {
        console.error('Failed to load inbox:', err && err.message ? err.message : err);
        inboxState.conversations = [];
      }
      updateInboxUnreadBadges();
    }

    function renderInboxConversationList() {
      const loadingState = document.getElementById('inbox-loading-state');
      const list = document.getElementById('inbox-conversation-list');
      if (!list || !loadingState) return;

      loadingState.classList.toggle('hidden', !inboxState.isLoading);
      if (inboxState.isLoading) {
        list.innerHTML = '';
        return;
      }

      const conversations = getInboxFilteredConversations();
      if (conversations.length === 0) {
        list.innerHTML = `
          <div class="px-3 py-6 text-center">
            <p class="text-sm font-semibold" style="color: #1E3A8A;">No messages</p>
            <p class="text-xs mt-1" style="color: #64748b;">No conversation matches your search.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = conversations.map((conversation) => {
        const latest = getLatestInboxMessage(conversation);
        const preview = latest ? latest.text : 'No messages yet';
        const selected = conversation.id === inboxState.selectedConversationId;
        const unread = conversation.unread || 0;
        const displayName = conversation.name || conversation.phone || 'Unknown Sender';
        const displayTime = latest ? latest.time : '-';
        return `
          <button type="button" class="inbox-conversation-item ${selected ? 'active' : ''}" data-conversation-id="${conversation.id}">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate" style="color: #0F172A;">${escapeInboxHtml(displayName)}</p>
                <p class="text-xs mt-0.5 truncate" style="color: #475569;">${escapeInboxHtml(conversation.phone || '')}</p>
              </div>
              <div class="text-right flex-shrink-0">
                ${inboxState.selectionMode ? `<input type="checkbox" class="inbox-select-checkbox mb-1" data-conversation-id="${conversation.id}" ${inboxState.selectedConversationIds.has(conversation.id) ? 'checked' : ''}>` : ''}
                <p class="text-[11px]" style="color: #64748b;">${escapeInboxHtml(displayTime)}</p>
                ${unread > 0 ? `<span class="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style="background: #DC2626; color: #ffffff;">${unread}</span>` : ''}
              </div>
            </div>
            <p class="text-xs mt-2 truncate" style="color: #475569;">${escapeInboxHtml(preview)}</p>
          </button>
        `;
      }).join('');
    }

    function scrollInboxThreadToBottom() {
      const container = document.getElementById('inbox-thread-messages');
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    }

    function renderInboxThread() {
      const emptyState = document.getElementById('inbox-thread-empty');
      const threadView = document.getElementById('inbox-thread-view');
      const nameEl = document.getElementById('inbox-thread-name');
      const phoneEl = document.getElementById('inbox-thread-phone');
      const lastEl = document.getElementById('inbox-thread-last');
      const messagesEl = document.getElementById('inbox-thread-messages');
      if (!emptyState || !threadView || !nameEl || !phoneEl || !lastEl || !messagesEl) return;

      const selected = getInboxConversationById(inboxState.selectedConversationId);
      if (!selected) {
        emptyState.classList.remove('hidden');
        threadView.classList.add('hidden');
        messagesEl.innerHTML = '';
        return;
      }

      const latest = getLatestInboxMessage(selected);
      nameEl.textContent = selected.name || selected.phone || 'Unknown Sender';
      phoneEl.textContent = selected.phone || '';
      lastEl.textContent = latest ? latest.time : '-';

      messagesEl.innerHTML = selected.messages.map((message) => {
        const outgoing = message.direction === 'outgoing';
        const alignClass = outgoing ? 'justify-end' : 'justify-start';
        const msgTypeClass = outgoing ? 'outgoing' : 'incoming';
        return `
          <div class="flex ${alignClass}">
            <div>
              <div class="inbox-message ${msgTypeClass}">${escapeInboxHtml(message.text)}</div>
              <p class="text-[11px] mt-1 ${outgoing ? 'text-right' : 'text-left'}" style="color: #64748b;">${escapeInboxHtml(message.time)}</p>
            </div>
          </div>
        `;
      }).join('');

      emptyState.classList.add('hidden');
      threadView.classList.remove('hidden');
      scrollInboxThreadToBottom();
    }

    function selectInboxConversation(conversationId, markRead = true) {
      const selected = getInboxConversationById(conversationId);
      if (!selected) return;
      inboxState.selectedConversationId = selected.id;
      if (markRead) {
        markInboxConversationRead(selected.id);
      }
      renderInboxConversationList();
      renderInboxThread();
    }

    function getCurrentUserName() {
      return (appConfig.user_name || defaultConfig.user_name || 'User').trim() || 'User';
    }

    function getCurrentUserRole() {
      return (appConfig.user_role || defaultConfig.user_role || 'Teacher').trim() || 'Teacher';
    }

    function getCurrentUserAvatar() {
      return (appConfig.user_avatar || defaultConfig.user_avatar || '').trim();
    }

    function getCurrentAccountUsername() {
      return String(currentAccountUsername || '').trim();
    }

    function canManageActivity() {
      return PRIVILEGED_ACTIVITY_ROLES.includes(getCurrentUserRole());
    }

    function isDeveloperRole() {
      return getCurrentUserRole() === 'Developer';
    }

    function canViewActivityLog() {
      const role = getCurrentUserRole();
      return role === 'Developer' || role === 'Admin';
    }

    function loadUserProfiles() {
      try {
        const raw = localStorage.getItem(USER_PROFILES_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function saveUserProfiles(profiles) {
      localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles || {}));
    }

    function renameUserProfileKey(oldUsername, newUsername) {
      const oldKey = String(oldUsername || '').trim().toLowerCase();
      const newKey = String(newUsername || '').trim().toLowerCase();
      if (!oldKey || !newKey || oldKey === newKey) return;
      const profiles = loadUserProfiles();
      const existing = profiles[oldKey];
      if (existing) {
        profiles[newKey] = existing;
        delete profiles[oldKey];
        saveUserProfiles(profiles);
      }
    }

    function mergePersistedProfile(username) {
      const key = String(username || '').trim().toLowerCase();
      if (!key) return;
      const profiles = loadUserProfiles();
      const profile = profiles[key];
      if (!profile || typeof profile !== 'object') return;
      if (profile.displayName) {
        appConfig.user_name = String(profile.displayName);
      }
      if (profile.avatar) {
        appConfig.user_avatar = String(profile.avatar);
      }
    }

    function saveCurrentUserProfile() {
      const key = getCurrentAccountUsername().toLowerCase();
      if (!key) return;
      const profiles = loadUserProfiles();
      profiles[key] = {
        displayName: getCurrentUserName(),
        avatar: getCurrentUserAvatar()
      };
      saveUserProfiles(profiles);
    }

    function renameCurrentAccountUsername(nextUsername) {
      const oldUsername = getCurrentAccountUsername();
      const newUsername = String(nextUsername || '').trim();
      if (!oldUsername || !newUsername) {
        return { ok: false, error: 'Username cannot be empty.' };
      }
      if (oldUsername.toLowerCase() === newUsername.toLowerCase()) {
        return { ok: true };
      }

      const users = loadUsers();
      const oldIndex = users.findIndex((u) => (u.username || '').toLowerCase() === oldUsername.toLowerCase());
      const duplicate = users.find((u) => (u.username || '').toLowerCase() === newUsername.toLowerCase());
      if (duplicate) {
        return { ok: false, error: 'Username already exists.' };
      }
      if (oldIndex < 0) {
        return { ok: false, error: 'Current account not found. Please log out then log in again.' };
      }
      users[oldIndex].username = newUsername;
      saveUsers(users);

      const requests = loadAccountRequests();
      let changedReq = false;
      requests.forEach((req) => {
        if ((req.username || '').toLowerCase() === oldUsername.toLowerCase()) {
          req.username = newUsername;
          req.updatedAt = Date.now();
          changedReq = true;
        }
      });
      if (changedReq) {
        saveAccountRequests(requests);
      }

      renameUserProfileKey(oldUsername, newUsername);
      currentAccountUsername = newUsername;
      persistAuthUser();
      return { ok: true };
    }

    function persistAuthUser() {
      const accountUsername = getCurrentAccountUsername() || getCurrentUserName();
      if (!currentAccountUsername) {
        currentAccountUsername = accountUsername;
      }
      sessionStorage.setItem('auth_user', JSON.stringify({
        username: accountUsername,
        displayName: getCurrentUserName(),
        role: getCurrentUserRole(),
        avatar: getCurrentUserAvatar()
      }));
      saveCurrentUserProfile();
    }

    function closeMenuDropdown() {
      const menu = document.getElementById('menu-dropdown');
      const menuBtn = document.getElementById('menu-btn');
      if (!menu || !menuBtn) return;
      menu.style.display = 'none';
      menuBtn.setAttribute('aria-expanded', 'false');
    }

    function updateMenuProfile() {
      const userName = getCurrentUserName();
      const userRole = getCurrentUserRole();
      const userAvatar = getCurrentUserAvatar();
      const avatar = document.getElementById('menu-user-avatar');
      const nameEl = document.getElementById('menu-user-name');
      const roleEl = document.getElementById('menu-user-role');
      const activityBtn = document.getElementById('activity-log-btn');
      const activityCaption = document.getElementById('activity-log-caption');
      const accountsBtn = document.getElementById('menu-accounts-btn');

      if (avatar) {
        if (userAvatar) {
          avatar.innerHTML = '';
          avatar.style.backgroundImage = `url("${userAvatar}")`;
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.backgroundRepeat = 'no-repeat';
        } else {
          avatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>';
          avatar.style.background = 'linear-gradient(135deg, #0EA5E9, #2563EB)';
          avatar.style.backgroundImage = '';
          avatar.style.backgroundSize = '';
          avatar.style.backgroundPosition = '';
          avatar.style.backgroundRepeat = '';
        }
      }
      if (nameEl) {
        nameEl.textContent = userName;
      }
      if (roleEl) {
        roleEl.textContent = userRole;
      }
      if (activityBtn) {
        const canView = canViewActivityLog();
        activityBtn.style.display = canView ? 'flex' : 'none';
        if (activityCaption) {
          activityCaption.style.display = canView ? 'block' : 'none';
        }
      }
      if (accountsBtn) {
        accountsBtn.style.display = isDeveloperRole() ? 'flex' : 'none';
      }
    }

    function getActivityType(action) {
      const text = (action || '').toLowerCase();
      if (text.includes('requested role')) return 'role';
      if (text.includes('role')) return 'role';
      if (text.includes('login')) return 'login';
      return 'other';
    }

    function logActivity(name, role, action, metadata = {}) {
      const now = new Date();
      const entry = {
        id: metadata.id || `act-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: name || getCurrentUserName(),
        role: role || getCurrentUserRole(),
        action,
        time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        date: now.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
        timestamp: now.getTime(),
        type: metadata.type || getActivityType(action),
        status: metadata.status || null,
        requestedRole: metadata.requestedRole || null,
        resolvedRole: metadata.resolvedRole || null,
        decidedBy: metadata.decidedBy || null
      };
      activityLog.push(entry);
      renderActivityLog(activityFilter);
      return entry.id;
    }

    function submitRoleChangeRequest(requestedRole) {
      roleRequestCounter += 1;
      return logActivity(
        getCurrentUserName(),
        getCurrentUserRole(),
        `Requested role: ${requestedRole}`,
        {
          id: `role-request-${Date.now()}-${roleRequestCounter}`,
          type: 'role',
          status: 'pending',
          requestedRole
        }
      );
    }

    function loadAccountRequests() {
      try {
        const raw = localStorage.getItem(ACCOUNT_REQUESTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    function saveAccountRequests(requests) {
      localStorage.setItem(ACCOUNT_REQUESTS_KEY, JSON.stringify(requests));
    }

    function loadUsers() {
      try {
        const raw = localStorage.getItem(USERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    function saveUsers(users) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function syncAccountRequestsToActivity() {
      const requests = loadAccountRequests();
      requests.forEach((req) => {
        const entryId = `account-request-${req.id}`;
        const existing = activityLog.find((item) => item.id === entryId);
        const requestDate = req.createdAt ? new Date(req.createdAt) : new Date();
        const status = req.status || 'pending';
        const resolvedRole = req.assignedRole || null;
        const decidedBy = req.decidedBy || null;
        const action = status === 'pending'
          ? `Account request: ${req.username}`
          : status === 'approved'
            ? `Approved account (${req.username}) as ${resolvedRole || 'Role'}`
            : `Declined account request (${req.username})`;

        if (existing) {
          existing.status = status;
          existing.requestedRole = resolvedRole;
          existing.resolvedRole = resolvedRole;
          existing.decidedBy = decidedBy;
          existing.action = action;
          existing.accountUsername = req.username;
          existing.accountPassword = req.password;
          existing.timestamp = req.updatedAt || req.createdAt || existing.timestamp;
          existing.time = new Date(existing.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          existing.date = new Date(existing.timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
        } else {
          activityLog.push({
            id: entryId,
            name: req.username || 'Pending User',
            role: status === 'approved' ? (resolvedRole || 'Approved') : 'Pending Approval',
            action,
            time: requestDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            date: requestDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
            timestamp: req.createdAt || Date.now(),
            type: 'account',
            status,
            requestedRole: resolvedRole,
            resolvedRole,
            decidedBy,
            accountUsername: req.username,
            accountPassword: req.password,
            accountRequestId: req.id
          });
        }
      });
    }

    function handleAccountDecision(entryId, decisionRole) {
      if (!isDeveloperRole()) return;
      const entry = activityLog.find((item) => item.id === entryId);
      if (!entry || entry.status !== 'pending') return;

      const requests = loadAccountRequests();
      const reqId = entry.accountRequestId;
      const req = requests.find((r) => r.id === reqId);
      if (!req || req.status !== 'pending') return;

      if (decisionRole === 'decline') {
        req.status = 'declined';
        req.decidedBy = getCurrentUserName();
        req.updatedAt = Date.now();
      } else {
        const assignedRole = decisionRole === 'approve' ? 'Teacher' : decisionRole;
        req.status = 'approved';
        req.assignedRole = assignedRole;
        req.decidedBy = getCurrentUserName();
        req.updatedAt = Date.now();

        const users = loadUsers();
        const index = users.findIndex((u) => (u.username || '').toLowerCase() === (req.username || '').toLowerCase());
        const approvedUser = { username: req.username, password: req.password, role: assignedRole };
        if (index >= 0) {
          users[index] = approvedUser;
        } else {
          users.push(approvedUser);
        }
        saveUsers(users);
      }

      saveAccountRequests(requests);
      syncAccountRequestsToActivity();
      renderActivityLog(activityFilter);
    }

    function handleRoleDecision(entryId, decision) {
      const entry = activityLog.find((item) => item.id === entryId);
      if (!entry || entry.status !== 'pending') return;
      if (!isDeveloperRole()) return;

      const decisionRole = decision === 'decline' ? null : (decision === 'approve' ? 'Teacher' : decision);
      const approver = getCurrentUserName();

      if (decisionRole) {
        appConfig.user_role = decisionRole;
        updateMenuProfile();
        persistAuthUser();
        pushRoleToSdk(decisionRole);
      }

      entry.status = decision === 'decline' ? 'declined' : 'approved';
      entry.resolvedRole = decisionRole;
      entry.decidedBy = approver;
      entry.action = decision === 'decline'
        ? `Declined role request (${entry.requestedRole})`
        : `Approved role request to ${decisionRole}`;
      entry.timestamp = Date.now();
      entry.time = new Date(entry.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      entry.date = new Date(entry.timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

      renderActivityLog(activityFilter);
    }

    function renderActivityLog(filter = 'all') {
      activityFilter = filter;
      const list = document.getElementById('activity-log-list');
      const filterButtons = document.querySelectorAll('.activity-filter-btn');
      if (!list) return;

      filterButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
      });

      const filtered = [...activityLog]
        .filter((entry) => {
          if (filter === 'all') return true;
          return entry.type === filter;
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      if (filtered.length === 0) {
        list.innerHTML = `
          <div class="text-center px-4 py-10">
            <p class="text-sm font-semibold" style="color: #1E3A8A;">No activity yet</p>
            <p class="text-xs mt-1" style="color: #64748b;">Actions will appear here once recorded.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = filtered.map((entry) => {
        const isLogin = entry.type === 'login';
        const isRole = entry.type === 'role';
        const isAccount = entry.type === 'account';
        const isPendingRoleRequest = isRole && entry.status === 'pending' && !!entry.requestedRole;
        const isPendingAccountRequest = isAccount && entry.status === 'pending' && !!entry.accountUsername;
        const icon = isLogin
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"></path></svg>'
          : isRole
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>'
            : isAccount
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>';
        const iconBg = isLogin ? '#DBEAFE' : isRole ? '#FEF3C7' : isAccount ? '#DCFCE7' : '#E2E8F0';
        const iconColor = isLogin ? '#1D4ED8' : isRole ? '#B45309' : isAccount ? '#166534' : '#334155';
        const decisionControls = isPendingRoleRequest && isDeveloperRole()
          ? `
              <div class="mt-2 flex gap-2 flex-wrap">
                <button type="button" class="role-decision-btn cool-btn cool-btn-admin px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="role" data-entry-id="${entry.id}" data-decision="Admin">Admin</button>
                <button type="button" class="role-decision-btn cool-btn cool-btn-coadmin px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="role" data-entry-id="${entry.id}" data-decision="Co Admin">Co Admin</button>
                <button type="button" class="role-decision-btn cool-btn cool-btn-decline px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="role" data-entry-id="${entry.id}" data-decision="decline">Decline</button>
              </div>
            `
          : isPendingAccountRequest && isDeveloperRole()
            ? `
                <div class="mt-2 flex gap-2 flex-wrap">
                  <button type="button" class="role-decision-btn cool-btn cool-btn-admin px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="account" data-entry-id="${entry.id}" data-decision="Admin">Admin</button>
                  <button type="button" class="role-decision-btn cool-btn cool-btn-coadmin px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="account" data-entry-id="${entry.id}" data-decision="Co Admin">Co Admin</button>
                  <button type="button" class="role-decision-btn cool-btn cool-btn-decline px-2.5 py-1 rounded text-[11px] font-semibold" data-kind="account" data-entry-id="${entry.id}" data-decision="decline">Decline</button>
                </div>
              `
            : '';
        const statusLine = isPendingRoleRequest
          ? `<p class="text-[11px] mt-1" style="color: #92400E;">Status: ${isDeveloperRole() ? 'Pending decision' : 'Waiting for Developer approval'}</p>`
          : isPendingAccountRequest
            ? `<p class="text-[11px] mt-1" style="color: #166534;">Status: ${isDeveloperRole() ? 'Waiting for approval' : 'Waiting for Developer approval'}</p>`
          : entry.status
            ? `<p class="text-[11px] mt-1" style="color: #475569;">Status: ${escapeInboxHtml(entry.status)}${entry.decidedBy ? ` by ${escapeInboxHtml(entry.decidedBy)}` : ''}</p>`
            : '';
        return `
          <article class="activity-item">
            <div class="flex items-start gap-3">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background: ${iconBg}; color: ${iconColor};">${icon}</div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold" style="color: #0F172A;">${escapeInboxHtml(entry.action)}</p>
                <p class="text-xs mt-0.5" style="color: #475569;">${escapeInboxHtml(entry.name)} | ${escapeInboxHtml(entry.role)}</p>
                <p class="text-[11px] mt-1" style="color: #64748b;">${escapeInboxHtml(entry.date)} | ${escapeInboxHtml(entry.time)}</p>
                ${statusLine}
                ${decisionControls}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    function openActivityModal() {
      const overlay = document.getElementById('activity-overlay');
      if (!overlay) return;
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });
      renderActivityLog(activityFilter);
    }

    function closeActivityModal() {
      const overlay = document.getElementById('activity-overlay');
      if (!overlay) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 220);
    }

    function openInboxModal() {
      const overlay = document.getElementById('inbox-overlay');
      if (!overlay) return;

      closeMenuDropdown();
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      inboxState.isOpen = true;
      inboxState.isLoading = true;
      renderInboxConversationList();
      renderInboxThread();
      updateInboxUnreadBadges();

      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });

      setTimeout(async () => {
        await loadInboxFromServer();
        inboxState.isLoading = false;
        const filtered = getInboxFilteredConversations();
        const selected = getInboxConversationById(inboxState.selectedConversationId);
        if (!selected && filtered.length > 0) {
          selectInboxConversation(filtered[0].id, true);
        } else {
          renderInboxConversationList();
          renderInboxThread();
        }
      }, 220);

      resetInboxSelection();
      if (inboxRefreshTimer) {
        clearInterval(inboxRefreshTimer);
      }
      inboxRefreshTimer = setInterval(async () => {
        if (!inboxState.isOpen) return;
        const previousSelected = inboxState.selectedConversationId;
        await loadInboxFromServer();
        if (previousSelected && getInboxConversationById(previousSelected)) {
          inboxState.selectedConversationId = previousSelected;
        }
        renderInboxConversationList();
        renderInboxThread();
        addLogEntry('delivered', '', {
          recipients: selected ? [{ name: selected.name, phone: selected.phone }] : [],
          message: text,
          timestamp: new Date()
        });
      }, 10000);
    }

    function closeInboxModal() {
      const overlay = document.getElementById('inbox-overlay');
      if (!overlay) return;

      overlay.classList.remove('is-open');
      inboxState.isOpen = false;
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 220);
      if (inboxRefreshTimer) {
        clearInterval(inboxRefreshTimer);
        inboxRefreshTimer = null;
      }
      resetInboxSelection();
    }

    function pushRoleToSdk(role) {
      const sdk = window.ElementSDK;
      if (!sdk) return;

      if (typeof sdk.updateConfig === 'function') {
        sdk.updateConfig({ user_role: role });
        return;
      }
      if (typeof sdk.setConfig === 'function') {
        sdk.setConfig({ user_role: role });
      }
    }

    function onConfigChange(nextConfig = {}, options = {}) {
      Object.assign(appConfig, nextConfig);
      const shouldPersist = !options.skipPersist;

      const appTitle = document.getElementById('app-title');
      const sendText = document.getElementById('send-btn-text');

      if (appTitle) {
        appTitle.textContent = appConfig.app_title || defaultConfig.app_title;
      }
      if (sendText) {
        sendText.textContent = appConfig.send_button_text || defaultConfig.send_button_text;
      }
      updateMenuProfile();
      if (shouldPersist) {
        persistAuthUser();
      }
    }

    function initializeApp() {
      const authUserRaw = sessionStorage.getItem('auth_user');
      onConfigChange(defaultConfig, { skipPersist: true });
      if (authUserRaw) {
        try {
          const authUser = JSON.parse(authUserRaw);
          if (authUser && typeof authUser === 'object') {
            currentAccountUsername = String(authUser.username || authUser.accountUsername || '').trim();
            onConfigChange({
              user_name: authUser.displayName || authUser.user_name || authUser.username || defaultConfig.user_name,
              user_role: authUser.role || defaultConfig.user_role,
              user_avatar: authUser.avatar || ''
            }, { skipPersist: true });
            mergePersistedProfile(currentAccountUsername || authUser.username || authUser.displayName || authUser.user_name);
          }
        } catch (_) {
          // Ignore malformed auth payload and continue with defaults.
        }
      }

      const sdk = window.ElementSDK;
      if (sdk && typeof sdk.getConfig === 'function') {
        const externalConfig = sdk.getConfig();
        if (externalConfig && typeof externalConfig === 'object') {
          onConfigChange(externalConfig, { skipPersist: true });
        }
      }
      if (sdk && typeof sdk.onConfigChange === 'function') {
        sdk.onConfigChange(onConfigChange);
      }

      if (!localStorage.getItem(ACTIVITY_RESET_FLAG_KEY)) {
        localStorage.removeItem(ACCOUNT_REQUESTS_KEY);
        localStorage.setItem(ACTIVITY_RESET_FLAG_KEY, '1');
      }
      activityLog.length = 0;
      persistAuthUser();
      logActivity(getCurrentUserName(), getCurrentUserRole(), 'Login');
      syncAccountRequestsToActivity();
    }

    function renderDeveloperAccountsManager() {
      const list = document.getElementById('accounts-list');
      if (!list) return;
      let currentUsername = '';
      try {
        const raw = sessionStorage.getItem('auth_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          currentUsername = String((parsed && parsed.username) || '').toLowerCase();
        }
      } catch (_) {}
      const users = loadUsers().sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')));
      if (users.length === 0) {
        list.innerHTML = '<p class="text-sm" style="color:#475569;">No accounts found.</p>';
        return;
      }
      list.innerHTML = users.map((user) => {
        const username = String(user.username || '');
        const role = String(user.role || 'Teacher');
        const isCoreDev = username.toLowerCase() === 'admin';
        const isCurrentUser = currentUsername && username.toLowerCase() === currentUsername;
        const isImmutable = isCoreDev || isCurrentUser;
        return `
          <div class="p-3 rounded-lg flex items-center justify-between gap-3" style="background:#F8FAFF;border:1px solid #BFDBFE;">
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate" style="color:#0F172A;">${escapeInboxHtml(username)}</p>
              <p class="text-xs" style="color:#64748b;">${escapeInboxHtml(role)}</p>
            </div>
            <div class="flex items-center gap-2">
              <select class="account-role-select px-2 py-1.5 rounded text-xs" data-username="${escapeInboxHtml(username)}" ${isImmutable ? 'disabled' : ''} style="background:#ffffff;border:1px solid #BFDBFE;color:#1E3A8A;opacity:${isImmutable ? '0.65' : '1'};">
                ${['Admin', 'Co Admin', 'Developer'].map((r) => `<option value="${r}" ${r === role ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
              <button type="button" class="account-delete-btn px-2.5 py-1.5 rounded text-xs font-semibold" data-username="${escapeInboxHtml(username)}" ${isImmutable ? 'disabled' : ''} style="background: rgba(239,68,68,0.12); color:#B91C1C; border:1px solid rgba(239,68,68,0.3); opacity:${isImmutable ? '0.5' : '1'};">Delete</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function openAccountsModal() {
      const overlay = document.getElementById('accounts-overlay');
      if (!overlay) return;
      renderDeveloperAccountsManager();
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    }

    function closeAccountsModal() {
      const overlay = document.getElementById('accounts-overlay');
      if (!overlay) return;
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }

    function initMenuFeature() {
      const menuBtn = document.getElementById('menu-btn');
      const menu = document.getElementById('menu-dropdown');
      const profileAvatarBtn = document.getElementById('menu-user-avatar');
      const editUsernameBtn = document.getElementById('edit-username-btn');
      const openInboxBtn = document.getElementById('menu-inbox-btn');
      const openActivityBtn = document.getElementById('activity-log-btn');
      const openAccountsBtn = document.getElementById('menu-accounts-btn');
      const logoutBtn = document.getElementById('menu-logout-btn');
      const closeInboxBtn = document.getElementById('close-inbox-btn');
      const closeActivityBtn = document.getElementById('close-activity-btn');
      const closeAccountsBtn = document.getElementById('close-accounts-btn');
      const inboxBackdrop = document.getElementById('inbox-backdrop');
      const activityBackdrop = document.getElementById('activity-backdrop');
      const accountsBackdrop = document.getElementById('accounts-backdrop');
      const accountsList = document.getElementById('accounts-list');
      const searchInput = document.getElementById('inbox-search-input');
      const conversationList = document.getElementById('inbox-conversation-list');
      const selectInboxBtn = document.getElementById('select-inbox-btn');
      const deleteInboxBtn = document.getElementById('delete-inbox-btn');
      const replyForm = document.getElementById('inbox-reply-form');
      const replyInput = document.getElementById('inbox-reply-input');
      const filterButtons = document.querySelectorAll('.activity-filter-btn');
      const activityLogList = document.getElementById('activity-log-list');

      if (!menuBtn || !menu || !openInboxBtn || !openActivityBtn || !searchInput || !conversationList || !replyForm || !replyInput) {
        return;
      }

      updateInboxUnreadBadges();
      renderInboxConversationList();
      renderInboxThread();
      updateInboxActionButtons();
      updateMenuProfile();
      if (openAccountsBtn) {
        openAccountsBtn.style.display = isDeveloperRole() ? 'flex' : 'none';
      }
      renderActivityLog('all');

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = menu.style.display === 'none' || !menu.style.display;
        menu.style.display = willOpen ? 'block' : 'none';
        menuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      if (profileAvatarBtn) {
        profileAvatarBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const picker = document.createElement('input');
          picker.type = 'file';
          picker.accept = 'image/*';
          picker.addEventListener('change', () => {
            const file = picker.files && picker.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              if (!result) return;
              appConfig.user_avatar = result;
              updateMenuProfile();
              persistAuthUser();
              logActivity(getCurrentUserName(), getCurrentUserRole(), 'Updated profile picture');
            };
            reader.readAsDataURL(file);
          });
          picker.click();
        });
      }

      if (editUsernameBtn) {
        editUsernameBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const current = getCurrentAccountUsername() || getCurrentUserName();
          const next = prompt('Enter new username:', current);
          if (next === null) return;
          const trimmed = String(next).trim();
          if (!trimmed) {
            alert('Username cannot be empty.');
            return;
          }
          const renameResult = renameCurrentAccountUsername(trimmed);
          if (!renameResult.ok) {
            alert(renameResult.error || 'Failed to update username.');
            return;
          }
          appConfig.user_name = trimmed;
          updateMenuProfile();
          persistAuthUser();
          logActivity(getCurrentUserName(), getCurrentUserRole(), `Changed username to ${trimmed}`);
        });
      }

      openInboxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenuDropdown();
        openInboxModal();
        logActivity(getCurrentUserName(), getCurrentUserRole(), 'Viewed Inbox');
      });

      openActivityBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenuDropdown();
        if (!canViewActivityLog()) return;
        syncAccountRequestsToActivity();
        logActivity(getCurrentUserName(), getCurrentUserRole(), 'Viewed Activity Log');
        renderActivityLog(activityFilter);
        openActivityModal();
      });

      if (openAccountsBtn) {
        openAccountsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          closeMenuDropdown();
          if (!isDeveloperRole()) return;
          openAccountsModal();
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          sessionStorage.removeItem('auth_user');
          window.location.href = 'Login/index.html';
        });
      }

      filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-filter') || 'all';
          renderActivityLog(filter);
        });
      });

      if (activityLogList) {
        activityLogList.addEventListener('click', (e) => {
          const btn = e.target ? e.target.closest('.role-decision-btn') : null;
          if (!btn) return;
          const entryId = btn.getAttribute('data-entry-id');
          const decision = btn.getAttribute('data-decision');
          const kind = btn.getAttribute('data-kind') || 'role';
          if (!entryId || !decision) return;
          if (kind === 'account') {
            handleAccountDecision(entryId, decision);
          } else {
            handleRoleDecision(entryId, decision);
          }
        });
      }

      if (closeInboxBtn) {
        closeInboxBtn.addEventListener('click', closeInboxModal);
      }
      if (closeActivityBtn) {
        closeActivityBtn.addEventListener('click', closeActivityModal);
      }
      if (inboxBackdrop) {
        inboxBackdrop.addEventListener('click', closeInboxModal);
      }
      if (activityBackdrop) {
        activityBackdrop.addEventListener('click', closeActivityModal);
      }
      if (accountsBackdrop) {
        accountsBackdrop.addEventListener('click', closeAccountsModal);
      }
      if (closeAccountsBtn) {
        closeAccountsBtn.addEventListener('click', closeAccountsModal);
      }
      if (accountsList) {
        accountsList.addEventListener('change', (e) => {
          const select = e.target ? e.target.closest('.account-role-select') : null;
          if (!select) return;
          const username = select.getAttribute('data-username');
          if (!username) return;
          if (select.disabled) return;
          if (!['Admin', 'Co Admin', 'Developer'].includes(select.value)) return;
          const users = loadUsers();
          const user = users.find((u) => (u.username || '') === username);
          if (!user) return;
          user.role = select.value;
          saveUsers(users);
          renderDeveloperAccountsManager();
        });

        accountsList.addEventListener('click', (e) => {
          const deleteBtn = e.target ? e.target.closest('.account-delete-btn') : null;
          if (!deleteBtn) return;
          const username = deleteBtn.getAttribute('data-username');
          if (!username) return;
          if (!confirm(`Delete account "${username}"?`)) return;
          const users = loadUsers().filter((u) => (u.username || '') !== username);
          saveUsers(users);
          renderDeveloperAccountsManager();
        });
      }

      if (selectInboxBtn) {
        selectInboxBtn.addEventListener('click', () => {
          inboxState.selectionMode = !inboxState.selectionMode;
          if (!inboxState.selectionMode) {
            inboxState.selectedConversationIds.clear();
          }
          updateInboxActionButtons();
          renderInboxConversationList();
        });
      }

      if (deleteInboxBtn) {
        deleteInboxBtn.addEventListener('click', async () => {
          if (!inboxState.selectionMode || inboxState.selectedConversationIds.size === 0) return;
          const selectedConvos = inboxState.conversations.filter(c => inboxState.selectedConversationIds.has(c.id));
          const slots = [...new Set(
            selectedConvos.flatMap(c => (c.messages || []).map(m => m.slot)).filter(s => Number.isInteger(s))
          )];
          if (slots.length === 0) {
            alert('No modem message slots found to delete.');
            return;
          }
          if (!confirm(`Delete ${slots.length} message slot(s) from GSM inbox?`)) return;

          try {
            const res = await fetch('/inbox/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slots })
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error((data && data.error) || `HTTP ${res.status}`);
            }

            await loadInboxFromServer();
            inboxState.selectedConversationIds.clear();
            updateInboxActionButtons();
            renderInboxConversationList();
            renderInboxThread();
          } catch (err) {
            alert(`Delete failed: ${(err && err.message) || 'Unknown error'}`);
          }
        });
      }

      searchInput.addEventListener('input', () => {
        inboxState.query = searchInput.value || '';
        renderInboxConversationList();
        const selected = getInboxConversationById(inboxState.selectedConversationId);
        if (selected) {
          const visibleIds = getInboxFilteredConversations().map(c => c.id);
          if (!visibleIds.includes(selected.id)) {
            inboxState.selectedConversationId = null;
            renderInboxThread();
          }
        }
      });

      conversationList.addEventListener('click', (e) => {
        const row = e.target ? e.target.closest('[data-conversation-id]') : null;
        if (!row) return;
        const conversationId = row.getAttribute('data-conversation-id');
        if (!conversationId) return;
        if (inboxState.selectionMode) {
          if (inboxState.selectedConversationIds.has(conversationId)) {
            inboxState.selectedConversationIds.delete(conversationId);
          } else {
            inboxState.selectedConversationIds.add(conversationId);
          }
          updateInboxActionButtons();
          renderInboxConversationList();
          return;
        }
        selectInboxConversation(conversationId, true);
      });

      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = getInboxConversationById(inboxState.selectedConversationId);
        if (!selected) return;

        const text = (replyInput.value || '').trim();
        if (!text) return;
        const targetPhone = normalizePhone(selected.phone || '');
        if (!targetPhone) {
          alert('Invalid target number.');
          return;
        }

        const replySendBtn = document.getElementById('inbox-reply-send');
        const originalReplyBtnText = replySendBtn ? replySendBtn.textContent : '';
        if (replySendBtn) {
          replySendBtn.disabled = true;
          replySendBtn.textContent = 'Sending...';
          replySendBtn.style.opacity = '0.75';
        }

        try {
          const res = await fetch('/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: targetPhone, message: text })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          const now = new Date();
          const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          selected.messages.push({
            id: `out-${Date.now()}`,
            direction: 'outgoing',
            text,
            time: timeLabel,
            epoch: now.getTime()
          });
          replyInput.value = '';

          renderInboxConversationList();
          renderInboxThread();
        } catch (err) {
          addLogEntry('failed', (err && err.message) || 'Inbox reply send failed.');
          alert(`Failed to send reply: ${(err && err.message) || 'Unknown error'}`);
        } finally {
          if (replySendBtn) {
            replySendBtn.disabled = false;
            replySendBtn.textContent = originalReplyBtnText || 'Send';
            replySendBtn.style.opacity = '1';
          }
        }
      });

      document.addEventListener('click', (e) => {
        const insideMenu = e.target ? e.target.closest('#menu-btn, #menu-dropdown') : null;
        if (!insideMenu) {
          closeMenuDropdown();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeMenuDropdown();
        if (inboxState.isOpen) closeInboxModal();
        closeActivityModal();
        closeAccountsModal();
        const templateOverlay = document.getElementById('template-overlay');
        if (templateOverlay && !templateOverlay.classList.contains('hidden')) {
          templateOverlay.classList.add('hidden');
        }
      });
    }

    // Initialize view state on page load
    document.addEventListener('DOMContentLoaded', async () => {
      const closeErrorBtn = document.getElementById('close-error-btn');
      const errorBackdrop = document.getElementById('error-backdrop');
      if (closeErrorBtn) closeErrorBtn.addEventListener('click', hideErrorModal);
      if (errorBackdrop) errorBackdrop.addEventListener('click', hideErrorModal);
      const nativeAlert = window.alert.bind(window);
      window.alert = (message) => {
        try {
          const text = String(message || '');
          const isNoticeLike = /^(imported|no valid contacts|select a grade|account is waiting|approved)/i.test(text.trim());
          const isErrorLike = !isNoticeLike && /(error|failed|invalid|declined|cannot|unable|not found|timeout)/i.test(text);
          showErrorModal(text, isErrorLike ? 'Error' : 'Notice');
        } catch (_) {
          nativeAlert(message);
        }
      };

      // Ensure Message Log is visible by default
      showMessageLog();
      setManageTab('students');
      initTemplateFeature();
      loadMessageLogFromStorage();
      renderMessageLogEntries();
      await loadContacts();
      renderContacts();
      initializeApp();
      initMenuFeature();

      // Add data-status attributes to existing messages for filtering
      const messageLog = document.getElementById('message-log');
      if (messageLog) {
        const messages = messageLog.querySelectorAll(':scope > div');

        messages.forEach((msg) => {
          const statusText = msg.querySelector('span[class*="inline-block"]')?.textContent.toLowerCase() || '';
          if (statusText.includes('delivered')) {
            msg.setAttribute('data-status', 'delivered');
          } else if (statusText.includes('failed')) {
            msg.setAttribute('data-status', 'failed');
          }
        });
      }
    });



