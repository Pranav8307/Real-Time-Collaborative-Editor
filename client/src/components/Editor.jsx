import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EditorView, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import { EditorState, StateField } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { foldGutter, indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { yCollab } from 'y-codemirror.next';
import { YjsWebSocketProvider } from '../services/yjs-provider';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import './Editor.css';

// Color palette for cursors and text
const colors = [
  { cursor: '#ff0000', selection: '#ff000040', text: '#ff6b6b', name: 'Red' },
  { cursor: '#00ff00', selection: '#00ff0040', text: '#51cf66', name: 'Green' },
  { cursor: '#0000ff', selection: '#0000ff40', text: '#4dabf7', name: 'Blue' },
  { cursor: '#ffff00', selection: '#ffff0040', text: '#ffd43b', name: 'Yellow' },
  { cursor: '#ff00ff', selection: '#ff00ff40', text: '#e599f7', name: 'Magenta' },
  { cursor: '#00ffff', selection: '#00ffff40', text: '#66d9ef', name: 'Cyan' },
];

// Create a custom extension to show active users and their colors
function createUserInfoExtension(awareness, currentUserId) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.userInfo = new Map();
      this.updateUserInfo();
      
      // Listen to awareness changes
      awareness.on('change', () => {
        this.updateUserInfo();
        view.dispatch();
      });
    }
    
    updateUserInfo() {
      this.userInfo.clear();
      awareness.getStates().forEach((state, clientId) => {
        if (state.user) {
          this.userInfo.set(clientId, {
            name: state.user.name || 'Unknown',
            color: state.user.color || '#ffffff',
            isCurrent: clientId === awareness.clientID,
          });
        }
      });
    }
    
    destroy() {
      // Cleanup if needed
    }
  }, {
    decorations: (v) => {
      // Return empty decorations - we'll show user info in a separate UI
      return Decoration.none;
    },
  });
}

// Component to show active users with their colors
function ActiveUsersList({ awareness, currentUserId }) {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    if (!awareness) return;
    
    const updateUsers = () => {
      const userList = [];
      const states = awareness.getStates();
      
      console.log('👥 Active users update:', states.size, 'users');
      
      states.forEach((state, clientId) => {
        if (state.user) {
          const userInfo = {
            id: clientId,
            name: state.user.name || state.user.email || 'Unknown',
            color: state.user.color || '#ffffff',
            isCurrent: clientId === awareness.clientID,
          };
          userList.push(userInfo);
          console.log('  - User:', userInfo.name, 'Color:', userInfo.color, 'IsCurrent:', userInfo.isCurrent);
        }
      });
      
      setUsers(userList);
    };
    
    // Initial update
    updateUsers();
    
    // Listen to awareness changes
    awareness.on('change', updateUsers);
    
    // Also check periodically in case events are missed
    const interval = setInterval(updateUsers, 1000);
    
    return () => {
      awareness.off('change', updateUsers);
      clearInterval(interval);
    };
  }, [awareness]);
  
  if (users.length === 0) {
    return (
      <div className="active-users-list">
        <span className="no-users">No other users</span>
      </div>
    );
  }
  
  return (
    <div className="active-users-list">
      {users.map((u) => (
        <div
          key={u.id}
          className={`active-user ${u.isCurrent ? 'current-user' : ''}`}
          style={{ 
            borderLeftColor: u.color,
            backgroundColor: u.isCurrent ? `${u.color}20` : 'rgba(255, 255, 255, 0.1)',
          }}
          title={u.isCurrent ? `${u.name} (You)` : u.name}
        >
          <span
            className="user-color-dot"
            style={{ backgroundColor: u.color }}
          ></span>
          <span className="user-name">{u.name}</span>
          {u.isCurrent && <span className="you-badge">(You)</span>}
        </div>
      ))}
    </div>
  );
}

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Wait for the component to render and editorRef to be attached
    const timer = setTimeout(() => {
      initializeEditor();
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [id, user]);

  const initializeEditor = async () => {
    try {
      console.log('Initializing editor for document:', id);
      // Load document metadata
      const doc = await api.getDocument(id);
      console.log('Document loaded:', doc);
      setTitle(doc.title);

      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Create Y.Text type for the editor content
      const ytext = ydoc.getText('content');
      
      // Note: Initial content will be loaded via WebSocket sync from server
      // The server maintains the Yjs document state in memory

      // Create awareness for cursors/selections
      const awareness = new Awareness(ydoc);
      // Use more of the user ID to get better color distribution
      // Convert user ID to a number using first 8 characters
      const userIdHash = user.id.replace(/[^0-9a-f]/gi, '').slice(0, 8) || user.id.slice(0, 8);
      const colorIndex = parseInt(userIdHash, 16) % colors.length;
      const userColor = colors[colorIndex];
      
      // Set user info in awareness with all color info
      awareness.setLocalStateField('user', {
        name: user.name || user.email,
        userId: user.id,
        color: userColor.cursor,
        selectionColor: userColor.selection,
        textColor: userColor.text,
      });
      
      console.log('🎨 User color assigned:', {
        name: user.name || user.email,
        userId: user.id,
        colorIndex,
        cursorColor: userColor.cursor,
        selectionColor: userColor.selection,
      });

      // Create WebSocket provider
      const provider = new YjsWebSocketProvider(id, user.id, ydoc, awareness);
      providerRef.current = provider;
      providerRef.current.awareness = awareness; // Store awareness for ref callback

      // Wait for editorRef to be ready, then create editor
      // yCollab will handle sync automatically once the editor is created
      let retryCount = 0;
      const maxRetries = 100; // 10 seconds max
      const checkAndCreateEditor = () => {
        console.log('Checking editorRef, attempt:', retryCount, 'ref:', editorRef.current);
        if (editorRef.current && !viewRef.current) {
          console.log('✅ editorRef is ready, creating editor view');
          createEditorView(ytext, awareness, userColor);
        } else if (!editorRef.current && retryCount < maxRetries) {
          retryCount++;
          retryTimeoutRef.current = setTimeout(checkAndCreateEditor, 100);
        } else {
          console.error('Editor ref not ready after max retries. editorRef.current:', editorRef.current);
          // Don't set error yet - let the ref callback try
          if (retryCount >= maxRetries) {
            setError('Failed to initialize editor: DOM element not ready. Please refresh the page.');
            setLoading(false);
          }
        }
      };
      
      // Start checking immediately
      checkAndCreateEditor();
    } catch (err) {
      console.error('Failed to initialize editor:', err);
      setError(err.message || 'Failed to load document');
      setLoading(false);
    }
  };

  const createEditorView = (ytext, awareness, userColor) => {
    try {
      // Basic CodeMirror setup
      // IMPORTANT: yCollab MUST be added BEFORE other extensions that modify the document
      const basicExtensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),
        syntaxHighlighting(defaultHighlightStyle),
        oneDark,
        javascript(),
        // Add collaborative cursors and selections
        // yCollab handles ALL synchronization between Yjs and CodeMirror automatically
        // This ensures real-time updates without refresh
        yCollab(ytext, awareness, {
          cursorColor: userColor.cursor,
          selectionColor: userColor.selection,
        }),
      ];
      
      // Create editor with Yjs content
      // yCollab will handle all sync automatically and update in real-time
      const view = new EditorView({
        doc: ytext.toString(),
        extensions: basicExtensions,
        parent: editorRef.current,
      });

      viewRef.current = view;
      console.log('✅ Editor view created successfully');
      setLoading(false);
    } catch (err) {
      console.error('Failed to create editor view:', err);
      setError('Failed to initialize editor: ' + err.message);
      setLoading(false);
    }
  };

  const cleanup = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
    if (providerRef.current) {
      providerRef.current.disconnect();
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
  };

  // Always render the editor container so editorRef can attach
  // Show loading overlay if still loading

  if (error) {
    return (
      <div className="editor-container">
        <div className="editor-error">
          <p>Error: {error}</p>
          <button onClick={() => navigate('/')}>Back to Documents</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back
        </button>
        <h2 className="editor-title">{title || 'Untitled Document'}</h2>
        <div className="editor-actions">
          {providerRef.current?.awareness && (
            <ActiveUsersList awareness={providerRef.current.awareness} currentUserId={user?.id} />
          )}
          <button 
            onClick={() => navigate('/profile')} 
            className="profile-link-button"
            title="View Profile"
          >
            {user.name || user.email}
          </button>
        </div>
      </div>
      <div className="editor-wrapper" style={{ position: 'relative' }}>
        {loading && (
          <div className="editor-loading" style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            color: 'white'
          }}>
            <div>
              <div className="loading-spinner"></div>
              <p>Loading editor...</p>
            </div>
          </div>
        )}
        <div 
          ref={(el) => {
            if (el) {
              editorRef.current = el;
              console.log('✅ editorRef attached to DOM element:', el);
              // If we have everything ready but editor not created yet, create it now
              if (!viewRef.current && ydocRef.current) {
                const ytext = ydocRef.current.getText('content');
                let awareness;
                if (providerRef.current && providerRef.current.awareness) {
                  awareness = providerRef.current.awareness;
                } else {
                  awareness = new Awareness(ydocRef.current);
                }
                // Use consistent color based on user ID (same logic as above)
                const userIdHash = user ? (user.id.replace(/[^0-9a-f]/gi, '').slice(0, 8) || user.id.slice(0, 8)) : '0';
                const colorIndex = parseInt(userIdHash, 16) % colors.length;
                const userColor = colors[colorIndex];
                // Small delay to ensure DOM is fully ready
                setTimeout(() => {
                  if (!viewRef.current && editorRef.current) {
                    console.log('Creating editor from ref callback');
                    createEditorView(ytext, awareness, userColor);
                  }
                }, 100);
              }
            }
          }} 
          className="editor-content"
          style={{ minHeight: '400px', width: '100%' }}
        ></div>
      </div>
    </div>
  );
}

export default Editor;

