### Mac

Source link: https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2

Build for mp3 support only

```bash
brew install lame
./configure --cc=clang --prefix=./dist --extra-version=tessus --enable-gpl --enable-version3 --enable-libmp3lame --disable-shared --extra-cflags="-I/opt/homebrew/opt/lame/include" --extra-ldflags="-L/opt/homebrew/opt/lame/lib" --extra-libs="-lmp3lame"
make -j4
make install
```
