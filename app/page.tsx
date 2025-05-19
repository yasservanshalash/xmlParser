'use client'
import { useEffect, useState } from "react";
export default function Home() {

  const [jsonData, setJsonData] = useState(null);

  useEffect(() => {
    fetch('/api/parse-xml')
      .then((res) => res.json())
      .then((data) => setJsonData(data))
      .catch((err) => console.error('Fetch error:', err));
  }, []);

  console.log(jsonData.Dashboard.Items);

  return (
 <div>
  {jsonData && (
    <pre>{JSON.stringify(jsonData.Dashboard.Items, null, 2)}</pre>
  )}
 </div>
  );
}
