const PAT = 'sbp_f6171d40c8f13c6e2ff727e42e592ffa62846308';
const ref = 'iylspdscllcstgfipydc';

async function updateAuth() {
  console.log("Fetching current config...");
  const getRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  });
  
  if (getRes.ok) {
        console.log("Current config retrieved successfully.");
  } else {
        console.log("GET error:", await getRes.text());
  }

  console.log("Patching Auth config with Hostinger SMTP...");
  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "mailer_autoconfirm": true,
      "mailer_secure_email_change_enabled": false,
      "smtp_host": "smtp.hostinger.com",
      "smtp_port": "465",
      "smtp_user": "noreply@tenks.co",
      "smtp_pass": "Tenks@2026",
      "smtp_sender_name": "InSchool AI",
      "smtp_admin_email": "noreply@tenks.co"
    })
  });
  
  const text = await patchRes.text();
  console.log("PATCH status:", patchRes.status);
  console.log("PATCH response:", text);
}

updateAuth();
