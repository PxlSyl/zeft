import React, { useEffect, useState } from 'react';
import * as Effect from 'effect/Effect';
import { 
  useCancellable, 
  useRetry, 
  useSWR,
  useReducerWithEffect,
  usePrioritizedEffects as usePrioritized,
  Priority,
  PriorityLevel,
  ResourceState
} from '../../react/hooks/advanced-hooks';

// Type pour les erreurs
type AppError = {
  message: string;
};

// Type pour les utilisateurs
type User = {
  id: string;
  name: string;
  role: string;
};

// Type pour les posts
type Post = {
  id: string;
  title: string;
  body: string;
};

// Type pour les commentaires
type Comment = {
  id: string;
  text: string;
  author: string;
};

// Simulate API calls
const fetchUserEffect = (userId: string): Effect.Effect<User, AppError, never> => 
  Effect.promise(async () => {
    await new Promise(r => setTimeout(r, 1500)); // Simulate delay
    return { id: userId, name: `User ${userId}`, role: 'user' };
  });

const fetchUserPostsEffect = (userId: string): Effect.Effect<Post[], AppError, never> =>
  Effect.promise(async () => {
    await new Promise(r => setTimeout(r, 1200)); // Simulate delay
    return [
      { id: '1', title: 'First post', body: 'Content 1' },
      { id: '2', title: 'Second post', body: 'Content 2' },
      { id: '3', title: 'Third post', body: 'Content 3' },
    ];
  });

const fetchCommentsEffect = (postId: string): Effect.Effect<Comment[], AppError, never> =>
  Effect.promise(async () => {
    await new Promise(r => setTimeout(r, 800)); // Simulate delay
    
    // Randomly fail to show retry functionality
    if (Math.random() < 0.3) {
      throw { message: 'Failed to fetch comments' } as AppError;
    }
    
    return [
      { id: '1', text: 'Great post!', author: 'Alice' },
      { id: '2', text: 'I disagree', author: 'Bob' },
      { id: '3', text: 'Interesting point', author: 'Charlie' },
    ];
  });

/**
 * User profile component using useCancellable
 */
function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading, run, cancel } = useCancellable<User, AppError>(
    fetchUserEffect(userId),
    {
      timeout: 5000, // 5 second timeout
      immediate: true,
      onSuccess: (data) => console.log('User loaded:', data),
      onError: (error) => console.error('Error loading user:', error)
    }
  );
  
  return (
    <div className="demo-component">
      <h3>User Profile (useCancellable)</h3>
      {isLoading && <div>Loading user...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && (
        <div>
          <div><strong>ID:</strong> {data.id}</div>
          <div><strong>Name:</strong> {data.name}</div>
          <div><strong>Role:</strong> {data.role}</div>
        </div>
      )}
      <div className="button-group">
        <button onClick={() => run()}>Reload</button>
        <button onClick={() => cancel()}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * Comments component using useRetry
 */
function Comments({ postId }: { postId: string }) {
  const { data, error, isLoading, retryCount, run, retry } = useRetry<Comment[], AppError>(
    fetchCommentsEffect(postId),
    {
      maxRetries: 3,
      baseDelay: 1000,
      retryStrategy: 'exponential',
      immediate: true
    }
  );
  
  return (
    <div className="demo-component">
      <h3>Comments (useRetry)</h3>
      {isLoading && <div>Loading comments{retryCount > 0 ? ` (Retry ${retryCount})` : ''}...</div>}
      {error && (
        <div>
          <div>Error: {error.message}</div>
          <button onClick={() => retry()}>Try Again</button>
        </div>
      )}
      {data && (
        <ul>
          {data.map(comment => (
            <li key={comment.id}>
              <strong>{comment.author}:</strong> {comment.text}
            </li>
          ))}
        </ul>
      )}
      <div className="button-group">
        <button onClick={() => run()}>Reload Comments</button>
      </div>
    </div>
  );
}

/**
 * Posts component using useSWR
 */
function Posts({ userId }: { userId: string }) {
  const { data, error, isValidating, revalidate } = useSWR<Post[], AppError>(
    fetchUserPostsEffect(userId),
    {
      key: `posts-${userId}`,
      revalidateOnFocus: true
    }
  );
  
  return (
    <div className="demo-component">
      <h3>Posts (useSWR)</h3>
      {isValidating && <div>Refreshing posts...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && (
        <ul>
          {data.map(post => (
            <li key={post.id}>
              <strong>{post.title}</strong>
              <p>{post.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="button-group">
        <button onClick={() => revalidate()}>Refresh Posts</button>
      </div>
    </div>
  );
}

/**
 * User reducer for useReducerWithEffect demo
 */
type UserState = {
  user: User | null;
  loading: boolean;
  error: AppError | null;
  role: string;
};

function userReducer(state: UserState, action: any) {
  switch (action.type) {
    case 'effect/start':
      return { ...state, loading: true, error: null };
    case 'effect/success':
      return {
        ...state,
        loading: false,
        user: action.payload,
        error: null
      };
    case 'effect/failure':
      return { ...state, loading: false, error: action.error };
    case 'effect/cancel':
      return { ...state, loading: false };
    case 'set_role':
      return { ...state, role: action.payload };
    default:
      return state;
  }
}

/**
 * UserManager component using useReducerWithEffect
 */
function UserManager({ userId }: { userId: string }) {
  const { state, dispatch, isEffectRunning, cancelEffect } = useReducerWithEffect<UserState, any, AppError>(
    userReducer,
    {
      initialState: { user: null, loading: false, error: null, role: 'user' },
      effectFactory: () => fetchUserEffect(userId)
    }
  );
  
  // Run the effect when component mounts
  useEffect(() => {
    dispatch({ type: 'effect/start', payload: userId, runEffect: true });
  }, [userId, dispatch]);
  
  return (
    <div className="demo-component">
      <h3>User Manager (useReducerWithEffect)</h3>
      {state.loading && <div>Loading user...</div>}
      {state.error && <div>Error: {state.error.message}</div>}
      {state.user && (
        <div>
          <div><strong>ID:</strong> {state.user.id}</div>
          <div><strong>Name:</strong> {state.user.name}</div>
          <div><strong>Role:</strong> {state.role}</div>
        </div>
      )}
      <div className="button-group">
        <button onClick={() => dispatch({ type: 'effect/start', payload: userId, runEffect: true })}>
          Reload User
        </button>
        <button onClick={() => cancelEffect()}>Cancel</button>
        <button onClick={() => dispatch({ type: 'set_role', payload: 'admin' })}>
          Make Admin
        </button>
      </div>
    </div>
  );
}

/**
 * Dashboard component using usePrioritized
 */
function Dashboard() {
  const priorityMapping = {
    critical: { level: PriorityLevel.High, weight: 100 },
    high: { level: PriorityLevel.High, weight: 50 },
    medium: { level: PriorityLevel.Medium, weight: 50 }
  };

  const { 
    resources, 
    isProcessing, 
    start: loadAll, 
    clear: cancelAll, 
    addEffect: loadResource, 
    removeEffect: cancelResource,
    getResourceState,
    isLoading
  } = usePrioritized({
    autoStart: true,
    concurrency: 2
  });
  
  // Vérifier si au moins une ressource est en cours de chargement
  const anyResourceLoading = () => {
    return getResourceState('user') === ResourceState.Loading || 
           getResourceState('posts') === ResourceState.Loading || 
           getResourceState('comments') === ResourceState.Loading;
  };
  
  // Helper to create a prioritized effect
  const createEffect = (id: string, priority: keyof typeof priorityMapping, effect: Effect.Effect<any, AppError, never>, dependencies?: string[]) => ({
    id,
    priority: priorityMapping[priority],
    effect,
    dependencies
  });
  
  // Add resources on mount
  useEffect(() => {
    loadResource(createEffect('user', 'critical', fetchUserEffect('123')));
    loadResource(createEffect('posts', 'high', fetchUserPostsEffect('123'), ['user']));
    loadResource(createEffect('comments', 'medium', fetchCommentsEffect('1'), ['posts']));
  }, []);
  
  // Fonction pour rendre le contenu de manière sûre en fonction du type
  const renderResource = (id: string) => {
    const state = getResourceState(id);
    
    if (state === ResourceState.Success) {
      switch (id) {
        case 'user': {
          const user = resources.get('user')?.result as User;
          return (
            <div>
              <div><strong>Name:</strong> {user.name}</div>
              <div><strong>Role:</strong> {user.role}</div>
            </div>
          );
        }
        case 'posts': {
          const posts = resources.get('posts')?.result as Post[];
          return (
            <ul>
              {posts.slice(0, 2).map(post => (
                <li key={post.id}>{post.title}</li>
              ))}
            </ul>
          );
        }
        case 'comments': {
          const comments = resources.get('comments')?.result as Comment[];
          return (
            <ul>
              {comments.slice(0, 2).map(comment => (
                <li key={comment.id}>{comment.author}: {comment.text}</li>
              ))}
            </ul>
          );
        }
        default:
          return <div>Unknown resource type</div>;
      }
    }
    return null;
  };
  
  return (
    <div className="demo-component">
      <h3>Dashboard (usePrioritized)</h3>
      
      {(isProcessing || anyResourceLoading()) && <div className="loading-banner">Loading resources...</div>}
      
      <div className="dashboard-grid">
        <div className="dashboard-item">
          <h4>User</h4>
          {getResourceState('user') === ResourceState.Loading && <div>Loading user...</div>}
          {getResourceState('user') === ResourceState.Error && 
            <div>Error: {resources.get('user')?.error?.message}</div>
          }
          {getResourceState('user') === ResourceState.Success && renderResource('user')}
          <button onClick={() => loadResource(createEffect('user', 'critical', fetchUserEffect('123')))}>
            Load User
          </button>
          <button onClick={() => cancelResource('user')}>Cancel User</button>
        </div>
        
        <div className="dashboard-item">
          <h4>Posts</h4>
          {getResourceState('posts') === ResourceState.Loading && <div>Loading posts...</div>}
          {getResourceState('posts') === ResourceState.Error && 
            <div>Error: {resources.get('posts')?.error?.message}</div>
          }
          {getResourceState('posts') === ResourceState.Success && renderResource('posts')}
          <button onClick={() => loadResource(createEffect('posts', 'high', fetchUserPostsEffect('123'), ['user']))}>
            Load Posts
          </button>
          <button onClick={() => cancelResource('posts')}>Cancel Posts</button>
        </div>
        
        <div className="dashboard-item">
          <h4>Comments</h4>
          {getResourceState('comments') === ResourceState.Loading && <div>Loading comments...</div>}
          {getResourceState('comments') === ResourceState.Error && 
            <div>Error: {resources.get('comments')?.error?.message}</div>
          }
          {getResourceState('comments') === ResourceState.Success && renderResource('comments')}
          <button onClick={() => loadResource(createEffect('comments', 'medium', fetchCommentsEffect('1'), ['posts']))}>
            Load Comments
          </button>
          <button onClick={() => cancelResource('comments')}>Cancel Comments</button>
        </div>
      </div>
      
      <div className="button-group">
        <button onClick={() => {
          loadResource(createEffect('user', 'critical', fetchUserEffect('123')));
          loadResource(createEffect('posts', 'high', fetchUserPostsEffect('123'), ['user']));
          loadResource(createEffect('comments', 'medium', fetchCommentsEffect('1'), ['posts']));
          loadAll();
        }}>Load All</button>
        <button onClick={() => cancelAll()}>Cancel All</button>
      </div>
    </div>
  );
}

/**
 * Main demo component
 */
export default function AdvancedHooksDemo() {
  const [userId] = useState('123');
  
  return (
    <div className="hooks-demo">
      <h2>Advanced Hooks Demo</h2>
      
      <div className="demo-grid">
        <UserProfile userId={userId} />
        <Comments postId="1" />
        <Posts userId={userId} />
        <UserManager userId={userId} />
        <Dashboard />
      </div>
      
      <style>
        {`
        .hooks-demo {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .demo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
        }
        
        .demo-component {
          border: 1px solid #e1e1e1;
          border-radius: 4px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          background: #fff;
        }
        
        .button-group {
          margin-top: 15px;
          display: flex;
          gap: 8px;
        }
        
        button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        
        button:hover {
          background: #0069d9;
        }
        
        .loading-banner {
          background: #f8f9fa;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 15px;
          text-align: center;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .dashboard-item {
          border: 1px solid #e1e1e1;
          border-radius: 4px;
          padding: 12px;
        }
        `}
      </style>
    </div>
  );
} 