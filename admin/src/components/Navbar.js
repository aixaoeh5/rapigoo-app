import React from 'react';

const Navbar = ({ onLogout }) => {
  return (
    <nav style={styles.nav}>
      <h3 style={styles.logo}>RAPIGOO Admin</h3>
      <button style={styles.button} onClick={onLogout}>
        Cerrar sesión
      </button>
    </nav>
  );
};

const styles = {
  nav: {
    backgroundColor: '#282c34',
    padding: '10px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    color: 'white',
    alignItems: 'center',
  },
  logo: { margin: 0 },
  button: {
    backgroundColor: '#61dafb',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default Navbar;
