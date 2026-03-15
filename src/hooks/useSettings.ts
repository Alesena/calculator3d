import { useState, useEffect } from "react";
import { UserSettings, DEFAULT_SETTINGS } from "@/types";
import { getUserSettings, saveUserSettings } from "@/lib/firestore";
import toast from "react-hot-toast";

export function useSettings(uid: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    getUserSettings(uid)
      .then(setSettings)
      .catch(() => toast.error("Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, [uid]);

  const save = async (data: UserSettings) => {
    if (!uid) return;
    try {
      await saveUserSettings(uid, data);
      setSettings(data);
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar");
    }
  };

  return { settings, loading, save };
}
