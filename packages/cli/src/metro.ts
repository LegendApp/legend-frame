import WebSocket from "ws";

// React Native packager message protocol v2, shared by Expo's Metro server.
export function reload(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/message`, {
      headers: { Origin: `http://127.0.0.1:${port}` },
    });
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Metro reload timed out."));
    }, 3000);
    socket.onopen = () =>
      socket.send(JSON.stringify({ version: 2, method: "reload" }));
    socket.onmessage = (event) => {
      if (JSON.parse(String(event.data)).method === "reload") {
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Cannot connect to Metro's reload endpoint."));
    };
  });
}
