"use client";

import { use, useState, useEffect } from "react";
import { useRepoData } from "@/lib/useRepoData";


export default function FilePage({ params }) {
  // 1. All Hooks
  const { folder, cid } = use(params);
  const { uploads, loading } = useRepoData();
  const [review, setReview] = useState("Waiting for content...");
  const [checks,setChecks]=useState([])
   const [isChecking, setIsChecking] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const decoded = decodeURIComponent(folder);

  // 2. Safe Data Selection (Using Optional Chaining)
  const file = uploads
    ?.find(f => f.folder === decoded)
    ?.data?.find(d => d.cid === cid);

  // 3. The API Function
  const getreview = async (content) => {
    if (isFetching) return; // Prevent double-calls
    setIsFetching(true);
    
    
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content }),
      });
      
      const data = await res.json();
      console.log("✅ API RESPONSE RECEIVED:", data);
      setReview(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ API ERROR:", err);
      setReview("Failed to fetch review.");
    } finally {
      setIsFetching(false);
    }
  };


  const codecheck=async (content)=>{

    if (isChecking) return; // Prevent double-calls
    setIsChecking(true);

     try {
      const res = await fetch("/api/codecheck/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: content }),
      });
      
      const data = await res.json();
      console.log("✅ API RESPONSE RECEIVED:", data);
      setChecks(data.response)
    } catch (err) {
      console.error("❌ API ERROR:", err);
      setChecks([]);
    } finally {
      setIsChecking(false);
    }
   

  }


  // 4. The Trigger (Effect)
  useEffect(() => {
    // Only trigger if we aren't loading, we have a file, and we haven't gotten a review yet
    if (!loading && file?.content  && review === "Waiting for content..."  && file?.name?.endsWith(".js")) {
      getreview(file.content);
      codecheck(file.content);
      
    }
  }, [loading, file, review]); // Re-run when these change



function normalizeChecks(checks) {
  const seen = new Set();

  return checks.filter(item => {
    if (!item.ruleId) return false;

    const key = `${item.ruleId}:${item.line}:${item.column}:${item.message}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}




  // 5. Early Returns
  if (loading) return <div className="p-20 text-white">Loading Repo...</div>;
  if (!file) return <div className="p-20 text-white">File not found...</div>;

  return (
    <div className="bg-black min-h-screen p-10 text-white">
      <h1 className="text-xl mb-4">File: {file.name}</h1>
      <pre className="bg-gray-900 p-4 rounded mb-10">{file.content}</pre>
      
      <div className="border-t border-purple-500 pt-5">
        <h2 className="text-purple-400 font-bold mb-2">AI Review Output:</h2>
        <pre className="text-white-400 font-mono whitespace-pre-wrap bg-black p-4">
          {isFetching ? "AI is thinking..." : review}
        </pre>

         <h2 className="text-purple-400 font-bold mb-2">Static check:</h2>
        <pre className="text-white-400 font-mono whitespace-pre-wrap bg-black p-4">

          {isChecking ? (
  <div className="text-gray-400">static check...</div>
) : (
  normalizeChecks(checks).map((item, idx) => (
    <div key={idx} className="p-2 border-b border-neutral-700">
      <div className="text-sm text-red-400">
        {item.message}
      </div>

      <div className="text-xs text-neutral-400">
        Rule: {item.ruleId} · Line {item.line}, Col {item.column}
      </div>

      {item.fix && (
        <pre className="mt-1 text-xs text-green-400">
          Fix: {item.fix.text}
        </pre>
      )}
    </div>
  ))
)}

</pre>
</div>
</div>
  );
}
