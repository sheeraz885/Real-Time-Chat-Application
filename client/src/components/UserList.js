import React, { useState } from 'react';
import UserDetailsModal from './UserDetailsModal';

const UserList = ({ users, selectedUser, onUserSelect, currentUser, token }) => {
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState(null);

  const handleUserClick = (user) => {
    onUserSelect(user);
  };

  const handleUserDetailsClick = (e, user) => {
    e.stopPropagation();
    setSelectedUserForDetails(user);
    setShowUserDetails(true);
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

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      // Show time if within 24 hours
      return messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // Within a week
      // Show day of week
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Show date
      return messageDate.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Chats
            </h3>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
              {users.length}
            </span>
          </div>
          
          <div className="space-y-1">
            {users.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 3a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 text-sm">No users available</p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user._id}
                  onClick={() => handleUserClick(user)}
                  className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    selectedUser && selectedUser._id === user._id
                      ? 'bg-blue-50 border border-blue-200 shadow-sm'
                      : 'hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 ${getRandomColor(user.name)} rounded-full flex items-center justify-center shadow-md`}>
                        <span className="text-white font-semibold text-sm">
                          {getInitials(user.name)}
                        </span>
                      </div>
                      {user.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {user.name}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      
                      {/* Last message preview */}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500 truncate">
                          {user.lastMessage ? (
                            <span className="flex items-center">
                              {user.lastMessage.length > 30 
                                ? `${user.lastMessage.substring(0, 30)}...` 
                                : user.lastMessage
                              }
                            </span>
                          ) : (
                            'No messages yet'
                          )}
                        </p>
                        <div className="flex items-center space-x-2">
                          {user.lastMessageTime && (
                            <span className="text-xs text-gray-400">
                              {formatMessageTime(user.lastMessageTime)}
                            </span>
                          )}
                          {user.unreadCount > 0 && (
                            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-medium">
                              {user.unreadCount > 99 ? '99+' : user.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* More options button */}
                    <button
                      onClick={(e) => handleUserDetailsClick(e, user)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-200 transition-all duration-200"
                      title="View user details"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {showUserDetails && selectedUserForDetails && (
        <UserDetailsModal
          user={selectedUserForDetails}
          currentUser={currentUser}
          token={token}
          onClose={() => {
            setShowUserDetails(false);
            setSelectedUserForDetails(null);
          }}
        />
      )}
    </>
  );
};

export default UserList;