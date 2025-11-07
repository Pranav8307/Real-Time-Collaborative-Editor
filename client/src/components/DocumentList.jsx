import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ShareDocument from './ShareDocument';
import './DocumentList.css';

function DocumentList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setCreating(true);
    try {
      const doc = await api.createDocument(newDocTitle.trim());
      setShowCreateModal(false);
      setNewDocTitle('');
      navigate(`/documents/${doc.id}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      alert('Failed to create document: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await api.deleteDocument(id);
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document: ' + error.message);
    }
  };

  const handleShareDocument = (id, e) => {
    e.stopPropagation();
    setSelectedDocId(id);
    setShowShareModal(true);
  };

  if (loading) {
    return <div className="document-list-container">Loading...</div>;
  }

  return (
    <div className="document-list-container">
      <div className="document-list-header">
        <h1>My Documents</h1>
        <div className="header-actions">
          <button
            onClick={() => navigate('/profile')}
            className="profile-button"
          >
            Profile
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="create-button"
          >
            + New Document
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents yet. Create your first document!</p>
        </div>
      ) : (
        <div className="document-grid">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="document-card"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
            <div className="document-card-header">
              <h3>{doc.title}</h3>
              <div className="card-actions">
                <button
                  onClick={(e) => handleShareDocument(doc.id, e)}
                  className="share-button-small"
                  title="Share document"
                >
                  Share
                </button>
                <button
                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                  className="delete-button"
                  title="Delete document"
                >
                  ×
                </button>
              </div>
            </div>
              <p className="document-meta">
                Modified: {new Date(doc.lastModified).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Document</h2>
            <form onSubmit={handleCreateDocument}>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title"
                autoFocus
                required
              />
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cancel-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDocTitle.trim()}
                  className="create-submit-button"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showShareModal && selectedDocId && (
        <ShareDocument
          documentId={selectedDocId}
          onClose={() => {
            setShowShareModal(false);
            setSelectedDocId(null);
          }}
        />
      )}
    </div>
  );
}

export default DocumentList;

