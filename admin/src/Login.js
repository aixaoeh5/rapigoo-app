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
    <div className="App">
      <header className="App-header">
        <h2>Panel de administrador RAPIGOO</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <br />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <br />
          <button type="submit">Ingresar</button>
        </form>
      </header>
    </div>
  );
};

export default Login;
