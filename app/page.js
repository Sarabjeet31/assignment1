// pages/index.js
"use client"
import AudioEditor from "@/components/Audio";


const Home = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Audio Cutter</h1>
      <AudioEditor />
    </div>
  );
};

export default Home;
