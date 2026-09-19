```bash
_init_owa(){
  cd $HOME/Desktop/dev/open-worship-app-dt
  git checkout package-lock.json
  git pull
  npm i
} 
cd_build_owa(){
  _init_owa
  npm run pack:mac
} 
cd_release_owa(){
  _init_owa
  npm run release
}
```
