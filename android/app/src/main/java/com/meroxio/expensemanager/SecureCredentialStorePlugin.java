package com.meroxio.expensemanager;

import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecureCredentialStore")
public class SecureCredentialStorePlugin extends Plugin {
  private static final String STORE_NAME = "meroxio_secure_credentials";
  private static final String PASSWORD_CREDENTIAL_KEY = "passwordCredential";

  @PluginMethod
  public void savePasswordCredential(PluginCall call) {
    String credential = call.getString("credential");
    if (credential == null || credential.isEmpty()) {
      call.reject("Missing credential");
      return;
    }
    try {
      getStore().edit().putString(PASSWORD_CREDENTIAL_KEY, credential).apply();
      JSObject result = new JSObject();
      result.put("ok", true);
      call.resolve(result);
    } catch (Exception exception) {
      call.reject(exception.getMessage());
    }
  }

  @PluginMethod
  public void loadPasswordCredential(PluginCall call) {
    try {
      JSObject result = new JSObject();
      result.put("credential", getStore().getString(PASSWORD_CREDENTIAL_KEY, null));
      call.resolve(result);
    } catch (Exception exception) {
      call.reject(exception.getMessage());
    }
  }

  @PluginMethod
  public void removePasswordCredential(PluginCall call) {
    try {
      getStore().edit().remove(PASSWORD_CREDENTIAL_KEY).apply();
      JSObject result = new JSObject();
      result.put("ok", true);
      call.resolve(result);
    } catch (Exception exception) {
      call.reject(exception.getMessage());
    }
  }

  private SharedPreferences getStore() throws Exception {
    MasterKey masterKey = new MasterKey.Builder(getContext())
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build();

    return EncryptedSharedPreferences.create(
      getContext(),
      STORE_NAME,
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    );
  }
}
