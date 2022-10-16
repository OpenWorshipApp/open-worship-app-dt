{
  "targets": [{
    "target_name": "owa",
    "sources": [ "src-binding.gyp/owa.cc" ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    'libraries': [],
    'dependencies': [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    "xcode_settings": {
      "OTHER_CPLUSPLUSFLAGS": ["-std=c++14", "-stdlib=libc++", "-mmacosx-version-min=10.8"],
      "OTHER_LDFLAGS": ["-framework CoreFoundation -framework AppKit -framework Contacts"]
    }
  }]
}
