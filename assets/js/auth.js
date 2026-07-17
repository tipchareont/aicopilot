window.Auth={
  save(result){
    localStorage.setItem('session_token',result.session.session_token);
    localStorage.setItem('session_id',result.session.session_id);
    localStorage.setItem('session_expires_at',result.session.expires_at);
    localStorage.setItem('username',result.user.username);
    localStorage.setItem('display_name',result.user.display_name);
    localStorage.setItem('role',result.user.role);
  },
  clear(){
    ['session_token','session_id','session_expires_at','username','display_name','role'].forEach(k=>localStorage.removeItem(k));
  },
  token(){return localStorage.getItem('session_token')},
  redirectToLogin(){
    this.clear();
    const path=location.pathname.replace(/\/+/g,'/');
    const prefix=/(\/dashboard\/|\/campaign\/|\/creative\/)/.test(path)?'../':'';
    location.href=prefix+'index.html';
  }
};