import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wirzwihpezssziavujbf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpcnp3aWhwZXpzc3ppYXZ1amJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTIxODYsImV4cCI6MjA5NjYyODE4Nn0.02pH24PkqO-SNP4qrOu-BU7U2mN3xCt_eQWf4Qqf9wc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'vishnu733ssuresh@gmail.com',
    password: '123',
  });
  
  if (error) {
    console.error('Supabase Auth Error:', error.message);
  } else {
    console.log('Supabase Auth Success:', data.session?.access_token.substring(0, 20) + '...');
    
    // Now test Django
    try {
      const response = await fetch('http://localhost:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: data.session?.access_token }),
      });
      const body = await response.json();
      console.log('Django Response:', response.status, body);
    } catch (e) {
      console.error('Django Error:', e.message);
    }
  }
}

testLogin();
