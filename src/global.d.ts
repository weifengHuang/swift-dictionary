// declare global {
//   interface Window {
//     ipcRenderer: {
//       invoke: any;
//     },
//     SpeexComment: any;
//     Ogg: any;
//     Speex: any;
//   }
// }

interface Window {
  ipcRenderer: {
    invoke: any;
  },
  SpeexComment: any;
  Ogg: any;
  Speex: any;
  PCMData: any
}