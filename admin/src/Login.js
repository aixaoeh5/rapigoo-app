import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const validEmail = 'admin@rapigoo.com';
  const validPassword = '2507rapigoo';

  const handleSubmit = (e) => {
    e.preventDefault();

    if (email === validEmail && password === validPassword) {
      onLogin();
    } else {
      alert('Correo o contraseña incorrectos');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1 className="login-title">RAPIGOO</h1>
          <p className="login-subtitle">Panel de Administración</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@rapigoo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
