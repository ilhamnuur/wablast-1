import React from "react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../hooks/useAuth";

const Sidebar = () => {
  const { activeTab, setActiveTab, sidebarOpen, closeSidebar } = useApp();
  const { currentUser, logout } = useAuth();

  const menuItems = [
    {
      section: "Dashboard",
      items: [{ id: "session", icon: "🏠", label: "Dashboard" }],
    },
    {
      section: "Pesan",
      items: [
        { id: "text", icon: "📝", label: "Kirim Teks" },
        { id: "image", icon: "🖼️", label: "Kirim Gambar" },
        { id: "document", icon: "📄", label: "Kirim Dokumen" },
      ],
    },
    {
      section: "Blast Pesan",
      items: [
        { id: "blast", icon: "🚀", label: "Blast Biasa" },
        { id: "blast-custom", icon: "📊", label: "Blast Custom" },
      ],
    },
    {
      section: "Data",
      items: [{ id: "contacts", icon: "📱", label: "Kontak & Group" }],
    },
    {
      section: "Tools",
      items: [{ id: "debug", icon: "🔧", label: "Debug Log" }],
    },
  ];

  const handleItemClick = (itemId) => {
    setActiveTab(itemId);

    // Close mobile sidebar when item is clicked
    if (window.innerWidth <= 1024) {
      closeSidebar();
    }
  };

  const handleLogout = () => {
    // Close sidebar on mobile before logout
    if (window.innerWidth <= 1024) {
      closeSidebar();
    }
    logout();
  };

  return (
    <div
      id="sidebar"
      className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"}`}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">WA Gateway</h1>
            <p className="text-sm text-gray-500">
              {currentUser.username}
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Menu */}
      <div className="sidebar-menu">
        {menuItems.map((section, sectionIndex) => (
          <div key={sectionIndex} className="sidebar-section">
            <div className="sidebar-section-title">{section.section}</div>
            {section.items.map((item) => (
              <div
                key={item.id}
                className={`sidebar-item ${
                  activeTab === item.id ? "active" : ""
                }`}
                onClick={() => handleItemClick(item.id)}
              >
                <div className="sidebar-item-icon">{item.icon}</div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Logout Only */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Akun</div>
          <div className="sidebar-item" onClick={handleLogout}>
            <div className="sidebar-item-icon">🚪</div>
            <span>Logout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
