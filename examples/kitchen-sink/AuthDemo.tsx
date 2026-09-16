import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { TextInput } from "@legend-apps/ui";
import { createAuthSession, type AuthSession } from "@legend-apps/auth-session";
import { ActionButton } from "./ActionButton";
export function AuthDemo() {
  const session = useRef<AuthSession | undefined>(undefined), active = useRef(false);
  const [redirect, setRedirect] = useState("");
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => { active.current = true; return () => { active.current = false; void session.current?.dismiss().catch(console.error); }; }, []);
  return <View style={{ gap: 8 }}>
    <Text className="text-foreground">Browser authentication</Text>
    <Text className="text-muted">Use your provider's authorization endpoint with client_id, response_type=code, scopes and PKCE challenge. The session adds state and redirect_uri. Callback credentials are not displayed.</Text>
    <ActionButton onPress={async () => {
      await session.current?.dismiss();
      const next = await createAuthSession();
      if (!active.current) { await next.dismiss(); return; }
      session.current = next; setRedirect(next.redirectUri); return next.redirectUri;
    }}>Prepare callback</ActionButton>
    <TextInput defaultValue="" onChangeText={setEndpoint} accessibilityLabel="Authorization URL" />
    <ActionButton disabled={!redirect || !endpoint} onPress={async () => {
      const current = session.current; if (!current) throw new Error("Prepare a callback first");
      const url = new URL(endpoint); url.searchParams.set("state", current.state); url.searchParams.set("redirect_uri", current.redirectUri);
      try { const result = await current.open(url.href); return result.type === "success" ? "Callback validated. The application can now exchange the authorization code." : result.type; }
      finally { if (session.current === current) { session.current = undefined; setRedirect(""); } }
    }}>Open system browser</ActionButton>
    <ActionButton onPress={async () => { await session.current?.dismiss(); session.current = undefined; setRedirect(""); }}>Cancel authentication</ActionButton>
  </View>;
}
