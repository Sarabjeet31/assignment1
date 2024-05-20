import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

const AudioEditor = () => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [audioFile, setAudioFile] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [trimmedAudioBuffer, setTrimmedAudioBuffer] = useState(null);

  useEffect(() => {
    if (waveformRef.current && !wavesurfer.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgb(0, 255, 0)', // Bright green wave color
        progressColor: 'rgb(100, 0, 100)',
        backend: 'WebAudio',
        backgroundColor: 'black', // Black background color
      });

      const regionsPlugin = RegionsPlugin.create({
        regions: [
          {
            drag: false,
            resize: true,
            color: 'rgba(0, 0, 0, 0.1)',
            handlesWidth: 10,
            handleStyle: {
              left: {
                backgroundColor: 'cyan',
                width: '10px',
                height: '100%',
                marginLeft: '-5px', // Adjust to center the handle
              },
              right: {
                backgroundColor: 'cyan',
                width: '10px',
                height: '100%',
                marginRight: '-5px', // Adjust to center the handle
              },
            },
          },
        ],
      });
      wavesurfer.current.registerPlugin(regionsPlugin);

      regionsPlugin.enableDragSelection({
        color: 'rgba(255, 0, 0, 0.1)',
      });

      wavesurfer.current.on('ready', () => {
        const duration = wavesurfer.current.getDuration();
        const region = regionsPlugin.addRegion({
          start: 0,
          end: duration,
          content: 'Trimming Region',
          color: 'rgba(0, 0, 0, 0.3)',
          drag: false,
          resize: true
        });
        setActiveRegion(region);
      });

      regionsPlugin.on('region-updated', (region) => {
        setActiveRegion(region);
      });

      regionsPlugin.on('region-created', (region) => {
        setActiveRegion(region);
      });
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    wavesurfer.current.load(url);
  };

  const handleTrim = () => {
    if (audioFile && wavesurfer.current && activeRegion) {
      const start = activeRegion.start;
      const end = activeRegion.end;

      const originalAudioContext = new AudioContext();
      const reader = new FileReader();
      reader.readAsArrayBuffer(audioFile);
      reader.onloadend = () => {
        originalAudioContext.decodeAudioData(reader.result, (buffer) => {
          const sampleRate = buffer.sampleRate;
          const startFrame = Math.floor(start * sampleRate);
          const endFrame = Math.floor(end * sampleRate);
          const frameCount = endFrame - startFrame;

          const trimmedBuffer = originalAudioContext.createBuffer(
            buffer.numberOfChannels,
            frameCount,
            sampleRate
          );

          for (let i = 0; i < buffer.numberOfChannels; i++) {
            trimmedBuffer.copyToChannel(buffer.getChannelData(i).slice(startFrame, endFrame), i);
          }

          setTrimmedAudioBuffer(trimmedBuffer);

          const offlineAudioContext = new OfflineAudioContext(
            trimmedBuffer.numberOfChannels,
            trimmedBuffer.length,
            trimmedBuffer.sampleRate
          );
          const bufferSource = offlineAudioContext.createBufferSource();
          bufferSource.buffer = trimmedBuffer;
          bufferSource.connect(offlineAudioContext.destination);
          bufferSource.start();

          offlineAudioContext.startRendering().then((renderedBuffer) => {
            const wavData = encodeWAV(renderedBuffer);
            const blob = new Blob([wavData], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            wavesurfer.current.load(url);
          });
        });
      };
    } else {
      console.log('No audio file or region selected.');
    }
  };

  const handleDownload = () => {
    if (trimmedAudioBuffer) {
      const offlineAudioContext = new OfflineAudioContext(
        trimmedAudioBuffer.numberOfChannels,
        trimmedAudioBuffer.length,
        trimmedAudioBuffer.sampleRate
      );
      const bufferSource = offlineAudioContext.createBufferSource();
      bufferSource.buffer = trimmedAudioBuffer;
      bufferSource.connect(offlineAudioContext.destination);
      bufferSource.start();

      offlineAudioContext.startRendering().then((renderedBuffer) => {
        const wavData = encodeWAV(renderedBuffer);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trimmed-audio.wav';
        a.click();
      });
    } else {
      console.log('No trimmed audio buffer available for download.');
    }
  };

  const handlePlayRegion = () => {
    if (activeRegion) {
      activeRegion.play();
    }
  };

  const encodeWAV = (buffer) => {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * channels * 2 + 44;
    const bufferView = new DataView(new ArrayBuffer(length));

    let offset = 0;

    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        bufferView.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    bufferView.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    bufferView.setUint32(offset, 16, true); offset += 4;
    bufferView.setUint16(offset, 1, true); offset += 2;
    bufferView.setUint16(offset, channels, true); offset += 2;
    bufferView.setUint32(offset, sampleRate, true); offset += 4;
    bufferView.setUint32(offset, sampleRate * channels * 2, true); offset += 4;
    bufferView.setUint16(offset, channels * 2, true); offset += 2;
    bufferView.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    bufferView.setUint32(offset, buffer.length * channels * 2, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = sample < 0 ? sample * 32768 : sample * 32767;
        bufferView.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return bufferView.buffer;
  };

  return (
    <div className="p-4">
      <input 
        type="file" 
        accept="audio/*" 
        onChange={handleFileChange} 
        className="mb-4 block w-full hidden"
        id="audioFileInput"
      />
      <label 
        htmlFor="audioFileInput"
        className="mb-4 bg-gray-200 hover:bg-gray-300 cursor-pointer px-4 py-2 rounded text-black text-m"
      >
        Browse File
      </label>
      <div ref={waveformRef} className="w-full mt-10 h-24 bg-black mb-4"></div>
      <div className="flex justify-between mt-20">
        <div>
          <button 
            onClick={handleDownload} 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
          >
            Download
          </button>
          <button 
            onClick={handlePlayRegion} 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Play Region
          </button>
        </div>
        <div>
          <button 
            onClick={handleTrim} 
            className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Trim
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioEditor;
