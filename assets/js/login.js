const form=document.getElementById('loginForm');
const button=document.getElementById('loginButton');
const message=document.getElementById('loginMessage');

function show(text,type=''){message.textContent=text;message.className=`message ${type}`.trim()}

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const username=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  const url=window.APP_CONFIG.LOGIN_URL;

  if(!username||!password){show('กรุณากรอก Username และ Password','error');return}
  if(!url||url.includes('PASTE_N8N')){show('กรุณาใส่ Login Production URL ใน config.js','error');return}

  button.disabled=true;button.textContent='กำลังเข้าสู่ระบบ...';show('');

  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const text=await response.text();
    const result=JSON.parse(text);
    if(!response.ok||!result.success)throw new Error(result.message||'Login ไม่สำเร็จ');
    window.Auth.save(result);
    show(`เข้าสู่ระบบสำเร็จ: ${result.user.display_name}`,'success');
    setTimeout(()=>location.href='dashboard/index.html',300);
  }catch(error){show(error.message||'เชื่อมต่อระบบไม่ได้','error')}
  finally{button.disabled=false;button.textContent='เข้าสู่ระบบ'}
});