import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getMobileBootstrap } from "../src/lib/klyx-api";
import { supabase } from "../src/lib/supabase";

type Destination = "/auth" | "/profile" | "/assistant" | null;

export default function IndexScreen() {
  const [destination, setDestination] = useState<Destination>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setDestination("/auth");
        return;
      }
      try {
        const bootstrap = await getMobileBootstrap();
        setDestination(bootstrap.profiles.length > 0 ? "/assistant" : "/profile");
      } catch {
        setDestination("/profile");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (destination) return <Redirect href={destination} />;

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
});
