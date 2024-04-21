export function base64ToUint8Array(base64String: string) {
  let raw = atob(base64String);
  let uint8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    uint8Array[i] = raw.charCodeAt(i);
  }
  return uint8Array;
}

export function loadScript(url: string) {
  return new Promise((resolve, reject) => {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}


export function decodeSpeex(fileBase64: string) {
  let fileUint8Array = base64ToUint8Array(fileBase64);
  let fileString = String.fromCharCode.apply(null, fileUint8Array as any)
  // todo 这里的全局变量从html上面的mcdit-js引入，后面去除
  const { Ogg, Speex, PCMData } = window ;
  var ogg = new Ogg(fileString, { file: true });
  ogg.demux();
  var header = Speex.parseHeader(ogg.frames[0]);
  var spx = new Speex({
    quality: 8,
    mode: header.mode,
    rate: header.rate,
  });
  var waveData = PCMData.encode({
    sampleRate: header.rate,
    channelCount: header.nb_channels,
    bytesPerSample: 2,
    data: spx.decode(ogg.bitstream(), ogg.segments),
  });

  return new Blob([Speex.util.str2ab(waveData)], { type: 'audio/wav' });
}
