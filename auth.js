// ============================================================
// ECOA FINANCEIRO — AUTH.JS (FIREBASE AUTH)
// ============================================================

// CONFIGURAÇÃO DO FIREBASE (Substitua com as chaves do seu console)
const firebaseConfig = {
  apiKey: "AIzaSyCydCOks5WvLKO8P58lZ75izFcXApa30xM",
  authDomain: "ecoa2-5196f.firebaseapp.com",
  projectId: "ecoa2-5196f",
  storageBucket: "ecoa2-5196f.firebasestorage.app",
  messagingSenderId: "324378435787",
  appId: "1:324378435787:web:595f2bc24bfe52ec713b4e"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.querySelector('#email').value;
  const password = document.querySelector('#password').value;

  try {
    // Tenta fazer o login
    await auth.signInWithEmailAndPassword(email, password);
    
    // Sucesso! Redireciona para o dashboard
    window.location.href = 'index.html';
  } catch (error) {
    console.error("Erro no login:", error);
    loginMessage.classList.remove('hidden');
    loginMessage.classList.add('text-red-400');
    
    // Mensagens de erro amigáveis
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      loginMessage.innerText = 'E-mail ou senha incorretos.';
    } else if (error.code === 'auth/invalid-email') {
      loginMessage.innerText = 'E-mail inválido.';
    } else {
      loginMessage.innerText = 'Erro ao conectar com o Firebase. Tente novamente.';
    }
  }
});
