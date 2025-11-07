import { useState, useEffect } from 'react';
import api from '../services/api';
import './ShareDocument.css';

function ShareDocument({ documentId, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // First, we need to get the user ID from email
      // For now, we'll use a simplified approach
      // In production, you'd have a user lookup endpoint
      await api.shareDocument(documentId, email, role);
      setSuccess(`Document shared with ${email} as ${role}!`);
      setEmail('');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to share document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share Document</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <form onSubmit={handleShare} className="share-form">
          <div className="form-group">
            <label>User Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Permission</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="role-select"
            >
              <option value="editor">Editor (can edit)</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="share-button">
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>

        <div className="share-info">
          <p><strong>Note:</strong> The user must have an account with this email.</p>
          <p>They will see this document in their "My Documents" list.</p>
        </div>
      </div>
    </div>
  );
}

export default ShareDocument;

