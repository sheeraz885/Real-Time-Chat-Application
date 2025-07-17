import React, { useState, useEffect } from 'react';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import ProfileModal from './ProfileModal';
import io from 'socket.io-client';

const Dashboard = ({ user, token, onLogout, onUserUpdate }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userMessages, setUserMessages] = useState({}); // Store messages for each user

  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
    });
    setSocket(newSocket);

    newSocket.emit('join', user.id);
    newSocket.emit('userOnline', user.id);

    newSocket.on('newMessage', (message) => {
      const otherUserId = message.senderId === user.id ? message.receiverId : message.senderId;
      
      // Add to current chat messages if it's the selected user
      if (selectedUser && (message.senderId === selectedUser._id || message.receiverId === selectedUser._id)) {
        setMessages(prev => [...prev, message]);
        
        // Mark message as read if chat is currently open with sender
        if (message.senderId !== user.id) {
          markMessagesAsRead(message.senderId);
        }
      }
      
      // Update user messages for recent message display
      setUserMessages(prev => ({
        ...prev,
        [otherUserId]: {
          ...prev[otherUserId],
          lastMessage: message.content,
          lastMessageTime: message.createdAt,
          unreadCount: message.senderId !== user.id && (!selectedUser || selectedUser._id !== message.senderId) 
            ? (prev[otherUserId]?.unreadCount || 0) + 1 
            : 0
        }
      }));
      
      // Update users list with recent message info
      setUsers(prevUsers => {
        const updatedUsers = prevUsers.map(u => {
          if (u._id === otherUserId) {
            const newUnreadCount = message.senderId !== user.id && (!selectedUser || selectedUser._id !== message.senderId)
              ? (u.unreadCount || 0) + 1
              : 0;
            
            return { 
              ...u, 
              lastMessage: message.content,
              lastMessageTime: message.createdAt,
              unreadCount: newUnreadCount
            };
          }
          return u;
        });
        
        // Sort users by last message time (most recent first)
        return updatedUsers.sort((a, b) => {
          if (!a.lastMessageTime && !b.lastMessageTime) return 0;
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });
      });
    });

    newSocket.on('messageSent', (message) => {
      const otherUserId = message.receiverId;
      
      // Add to current chat messages if it's the selected user
      if (selectedUser && (message.senderId === selectedUser._id || message.receiverId === selectedUser._id)) {
        setMessages(prev => [...prev, message]);
      }
      
      // Update user messages for recent message display
      setUserMessages(prev => ({
        ...prev,
        [otherUserId]: {
          ...prev[otherUserId],
          lastMessage: message.content,
          lastMessageTime: message.createdAt,
          unreadCount: 0 // Reset unread count for sent messages
        }
      }));
      
      // Update users list with recent message info
      setUsers(prevUsers => {
        const updatedUsers = prevUsers.map(u => 
          u._id === otherUserId 
            ? { 
                ...u, 
                lastMessage: message.content,
                lastMessageTime: message.createdAt,
                unreadCount: 0
              }
            : u
        );
        
        // Sort users by last message time (most recent first)
        return updatedUsers.sort((a, b) => {
          if (!a.lastMessageTime && !b.lastMessageTime) return 0;
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });
      });
    });

    newSocket.on('messagesMarkedAsRead', ({ senderId, receiverId }) => {
      // Update unread count to 0 for the user whose messages were marked as read
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u._id === senderId 
            ? { ...u, unreadCount: 0 }
            : u
        )
      );
      
      setUserMessages(prev => ({
        ...prev,
        [senderId]: {
          ...prev[senderId],
          unreadCount: 0
        }
      }));
    });

    fetchUsers();

    return () => {
      newSocket.close();
    };
  }, [user.id, token, selectedUser]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        const otherUsers = userData.filter(u => u._id !== user.id);
        
        // Fetch recent messages for each user
        const usersWithMessages = await Promise.all(
          otherUsers.map(async (otherUser) => {
            try {
              const messagesResponse = await fetch(`http://localhost:5000/api/messages/${otherUser._id}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (messagesResponse.ok) {
                const userMessages = await messagesResponse.json();
                const lastMessage = userMessages[userMessages.length - 1];
                
                if (lastMessage) {
                  // Count unread messages (messages from other user that are not read)
                  const unreadCount = userMessages.filter(msg => 
                    msg.senderId === otherUser._id && !msg.isRead
                  ).length;
                  
                  return {
                    ...otherUser,
                    lastMessage: lastMessage.content,
                    lastMessageTime: lastMessage.createdAt,
                    unreadCount: unreadCount
                  };
                }
              }
            } catch (error) {
              console.error(`Error fetching messages for user ${otherUser._id}:`, error);
            }
            
            return {
              ...otherUser,
              lastMessage: null,
              lastMessageTime: null,
              unreadCount: 0
            };
          })
        );
        
        // Sort users by last message time (most recent first)
        const sortedUsers = usersWithMessages.sort((a, b) => {
          if (!a.lastMessageTime && !b.lastMessageTime) return 0;
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });
        
        setUsers(sortedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (receiverId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${receiverId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const messageData = await response.json();
        setMessages(messageData);
        
        // Mark messages as read and reset unread count
        await markMessagesAsRead(receiverId);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async (senderId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/mark-read/${senderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Update local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u._id === senderId 
              ? { ...u, unreadCount: 0 }
              : u
          )
        );
        
        setUserMessages(prev => ({
          ...prev,
          [senderId]: {
            ...prev[senderId],
            unreadCount: 0
          }
        }));

        // Emit socket event to notify sender that messages were read
        if (socket) {
          socket.emit('markMessagesAsRead', { senderId, receiverId: user.id });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleUserSelect = (selectedUser) => {
    setSelectedUser(selectedUser);
    fetchMessages(selectedUser._id);
  };

  const sendMessage = (content) => {
    if (socket && selectedUser) {
      const messageData = {
        senderId: user.id,
        receiverId: selectedUser._id,
        content
      };
      
      socket.emit('sendMessage', messageData);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        const response = await fetch('http://localhost:5000/api/account', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          alert('Account deleted successfully');
          onLogout();
        } else {
          const data = await response.json();
          alert(data.message);
        }
      } catch (error) {
        alert('Error deleting account');
      }
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRandomColor = (name) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-teal-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading ChatApp</h3>
          <p className="text-gray-600">Setting up your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 ${getRandomColor(user.name)} rounded-full flex items-center justify-center shadow-lg ring-2 ring-white ring-opacity-50`}>
                <span className="text-white font-bold text-sm">
                  {getInitials(user.name)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ChatApp</h2>
                <p className="text-sm text-white text-opacity-90">Welcome, {user.name.split(' ')[0]}</p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setShowProfile(true)}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-all duration-200 hover:scale-110"
                title="Profile Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-white hover:bg-red-500 hover:bg-opacity-80 rounded-full transition-all duration-200 hover:scale-110"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* User List */}
        <UserList 
          users={users} 
          selectedUser={selectedUser} 
          onUserSelect={handleUserSelect}
          currentUser={user}
          token={token}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            messages={messages}
            currentUser={user}
            onSendMessage={sendMessage}
            token={token}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50">
            <div className="text-center max-w-lg px-8">
              {/* Welcome Animation */}
              <div className="relative mb-8">
                <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Welcome Content */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-3">
                    Welcome to <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ChatApp</span>
                  </h1>
                  <p className="text-xl text-gray-600 mb-2">Hello, {user.name}! 👋</p>
                  <p className="text-gray-500">Select a conversation from the sidebar to start chatting</p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Real-time Chat</h3>
                    <p className="text-sm text-gray-600">Instant messaging with live updates</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Online Status</h3>
                    <p className="text-sm text-gray-600">See who's online and available</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Secure</h3>
                    <p className="text-sm text-gray-600">Your conversations are protected</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={() => setShowProfile(true)}
                      className="flex items-center space-x-2 bg-white text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm border border-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium">Edit Profile</span>
                    </button>
                    <button className="flex items-center space-x-2 bg-white text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm border border-gray-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium">Settings</span>
                    </button>
                  </div>
                </div>

                {/* Stats */}
                {users.length > 0 && (
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">
                      💬 You have <span className="font-semibold text-blue-600">{users.length}</span> contact{users.length !== 1 ? 's' : ''} available
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          user={user}
          token={token}
          onClose={() => setShowProfile(false)}
          onUserUpdate={onUserUpdate}
          onDeleteAccount={handleDeleteAccount}
        />
      )}
    </div>
  );
};

export default Dashboard;