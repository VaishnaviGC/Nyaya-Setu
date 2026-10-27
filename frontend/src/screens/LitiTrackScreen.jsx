
import { useEffect, useState, useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";

import {
  getSavedCases,
  saveCase as saveCaseApi,
  deleteSavedCase,
  simplifyCourtOrder,
  uploadCourtOrderPdf,
  getLiveCaseDetails,
} from "../api";
import { useAuth } from "../AuthContext";
import { COLORS } from "../theme";

const ECOURTS_URL = "https://services.ecourts.gov.in/ecourtindia_v6/";


function formatSavedDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function LitiTrackScreen() {
  const { token } = useAuth();

  const [cnr, setCnr] = useState("");
  const [nickname, setNickname] = useState("");
  const [savedCases, setSavedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderText, setOrderText] = useState("");
const [simplifiedOrder, setSimplifiedOrder] = useState("");
const [simplifying, setSimplifying] = useState(false);
const [simplifyError, setSimplifyError] = useState("");
const [pdfUploading, setPdfUploading] = useState(false);
const [uploadedPdfName, setUploadedPdfName] = useState("");
const [liveCases, setLiveCases] = useState({});
const [liveErrors, setLiveErrors] = useState({});
const [loadingLiveCaseId, setLoadingLiveCaseId] = useState(null);

  const loadCases = useCallback(async () => {
    if (!token) {
      setSavedCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const cases = await getSavedCases(token);
      setSavedCases(cases);
    } catch (error) {
      Alert.alert(
        "Couldn't load cases",
        error.message || "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  async function saveCase() {
    const normalizedCnr = cnr.trim().toUpperCase();
    const normalizedNickname = nickname.trim();

    if (!/^[A-Z0-9]{16}$/.test(normalizedCnr)) {
      Alert.alert(
        "Check the CNR number",
        "A CNR number should contain 16 letters and digits, without spaces or hyphens."
      );
      return;
    }

    if (normalizedNickname.length > 100) {
      Alert.alert(
        "Nickname too long",
        "Please keep the case nickname within 100 characters."
      );
      return;
    }

    if (!token) {
      Alert.alert("Login required", "Please log in to save a case.");
      return;
    }

    if (savedCases.some((item) => item.cnr === normalizedCnr)) {
      Alert.alert(
        "Already saved",
        "This case is already in your saved list."
      );
      return;
    }

    setSaving(true);

    try {
      await saveCaseApi(normalizedCnr, token, normalizedNickname);
      setCnr("");
      setNickname("");
      await loadCases();

      Alert.alert(
        "Case saved",
        "Your case has been saved to your account."
      );
    } catch (error) {
      Alert.alert(
        "Couldn't save case",
        error.message || "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCase(caseId) {
    if (!token) {
      Alert.alert(
        "Login required",
        "Please log in to manage saved cases."
      );
      return;
    }

    try {
      await deleteSavedCase(caseId, token);
      await loadCases();
    } catch (error) {
      Alert.alert(
        "Couldn't remove case",
        error.message || "Please try again."
      );
    }
  }

  async function openOfficialPortal() {
    try {
      await Linking.openURL(ECOURTS_URL);
    } catch {
      Alert.alert(
        "Unable to open link",
        "Please open the official eCourts website in your browser."
      );
    }
  }

async function fetchLiveCase(cnrValue, caseId) {
  if (!token) {
    Alert.alert("Login required", "Please log in to fetch live case details.");
    return;
  }
  setLoadingLiveCaseId(caseId);
  setLiveErrors((previous) => ({ ...previous, [caseId]: "" }));
  try {
    const response = await getLiveCaseDetails(cnrValue, token);
    const caseData = response?.data?.courtCaseData || response?.courtCaseData || response?.data || response;
    setLiveCases((previous) => ({ ...previous, [caseId]: caseData }));
  } catch (error) {
    setLiveErrors((previous) => ({ ...previous, [caseId]: error.message || "Unable to fetch live case details." }));
  } finally {
    setLoadingLiveCaseId(null);
  }
}

function displayLiveValue(value) {
  if (value === null || value === undefined || value === "") return "Not available";
  if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "string" ? item : (item.name || item.partyName || JSON.stringify(item))).join(", ") : "None listed";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const handleSimplifyOrder = async () => {
  if (!orderText.trim()) {
    setSimplifyError("Please paste the court order text first.");
    return;
  }

  setSimplifying(true);
  setSimplifyError("");
  setSimplifiedOrder("");

  try {
    const response = await simplifyCourtOrder(orderText.trim());

    if (response.simplified_text) {
      setSimplifiedOrder(response.simplified_text);
    } else {
      setSimplifyError("No explanation was returned. Please try again.");
    }
  } catch (error) {
    setSimplifyError(
      error.message || "Unable to simplify the court order. Please try again."
    );
  } finally {
    setSimplifying(false);
  }
};


async function handleUploadCourtOrderPdf() {
  setSimplifyError("");
  setSimplifiedOrder("");

  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (pickerResult.canceled) return;

    const file = pickerResult.assets?.[0];

    if (!file?.uri) {
      throw new Error("Couldn't access the selected PDF. Please select it again.");
    }

    if (file.size && file.size > 10 * 1024 * 1024) {
      throw new Error("Please choose a PDF smaller than 10 MB.");
    }

    if (!token) {
      throw new Error("Please log in before uploading a court order.");
    }

    setPdfUploading(true);
    setUploadedPdfName(file.name || "court-order.pdf");

    const FileSystem = await import("expo-file-system/legacy");

    const cacheDirectory = FileSystem.cacheDirectory;

    if (!cacheDirectory) {
      throw new Error("The app cache directory is unavailable.");
    }

    const safeName = (file.name || "court-order.pdf").replace(
      /[^\w.-]/g,
      "_"
    );

    const destination = `${cacheDirectory}${Date.now()}_${safeName}`;

    const copiedFile = await FileSystem.copyAsync({
      from: file.uri,
      to: destination,
    });

    const response = await uploadCourtOrderPdf(
      destination,
      file.name || "court-order.pdf",
      token
    );

    if (response?.simplified_text) {
      setSimplifiedOrder(response.simplified_text);
      setOrderText("");
    } else {
      throw new Error("No explanation was returned. Please try another PDF.");
    }
  } catch (error) {
    setSimplifyError(
      error.message || "Unable to process the PDF. Please try again."
    );
  } finally {
    setPdfUploading(false);
  }
}


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>LITITRACK</Text>

        <Text style={styles.title}>Your court cases</Text>

        <Text style={styles.description}>
          Save your CNR numbers here and use the official eCourts portal to
          check case information.
        </Text>
      </View>

    
<View style={styles.card}>
  <Text style={styles.sectionTitle}>
    Understand a Court Order
  </Text>

  <Text style={styles.description}>
    Paste the text of a court order to get an explanation
    in simple, everyday language.
  </Text>

  <Text style={styles.label}>Court order text</Text>

  <TextInput
    value={orderText}
    onChangeText={(value) => {
      setOrderText(value);
      setSimplifyError("");
    }}
    placeholder="Paste the court order text here..."
    placeholderTextColor={COLORS.grey}
    multiline
    textAlignVertical="top"
    autoCapitalize="sentences"
    style={[styles.input, styles.orderInput]}
    accessibilityLabel="Court order text"
  />

  <Pressable
    style={[
      styles.primaryButton,
      simplifying && { opacity: 0.6 },
    ]}
    onPress={handleSimplifyOrder}
    disabled={simplifying}
  >
    {simplifying ? (
      <ActivityIndicator color="#FFFFFF" />
    ) : (
      <Text style={styles.primaryButtonText}>
        Explain in Simple Language
      </Text>
    )}
  </Pressable>

  <Pressable
    style={[styles.secondaryButton, pdfUploading && { opacity: 0.6 }]}
    onPress={handleUploadCourtOrderPdf}
    disabled={pdfUploading || simplifying}
  >
    {pdfUploading ? (
      <ActivityIndicator color={COLORS.navy} />
    ) : (
      <Text style={styles.secondaryButtonText}>Upload Court Order PDF & Explain</Text>
    )}
  </Pressable>

  {uploadedPdfName ? (
    <Text style={styles.hint}>Selected document: {uploadedPdfName}</Text>
  ) : null}

  {simplifyError ? (
    <Text style={styles.errorText}>
      {simplifyError}
    </Text>
  ) : null}

  {simplifiedOrder ? (
    <View style={styles.explanationBox}>
      <Text style={styles.explanationTitle}>
        Simple Explanation
      </Text>

      <Text selectable style={styles.explanationText}>
        {simplifiedOrder}
      </Text>
    </View>
  ) : null}

  <Text style={styles.hint}>
    This is an AI-generated explanation for understanding
    the text, not legal advice. Verify important details
    with a qualified lawyer.
  </Text>
</View>


      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a case</Text>

        <Text style={styles.label}>CNR number</Text>

        <TextInput
          value={cnr}
          onChangeText={(value) =>
            setCnr(value.toUpperCase().replace(/\s/g, ""))
          }
          placeholder="Enter 16-character CNR"
          placeholderTextColor={COLORS.grey}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          style={styles.input}
          accessibilityLabel="CNR number"
        />

        <Text style={styles.hint}>
          A CNR is a 16-character case identification number. You can find it
          on the official court portal or your case documents.
        </Text>

        <Text style={styles.label}>Case nickname (optional)</Text>

        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="e.g. My property case"
          placeholderTextColor={COLORS.grey}
          autoCapitalize="sentences"
          autoCorrect={false}
          maxLength={100}
          style={styles.input}
          accessibilityLabel="Case nickname"
          returnKeyType="done"
        />

        <Text style={styles.hint}>
          Choose a name that helps you remember this case. This is your own
          label, not the official court case title.
        </Text>

        <Pressable
          style={[
            styles.primaryButton,
            saving && { opacity: 0.6 },
          ]}
          onPress={saveCase}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Save case</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={openOfficialPortal}
        >
          <Text style={styles.secondaryButtonText}>
            Open official eCourts portal ↗
          </Text>
        </Pressable>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Saved cases</Text>
        <Text style={styles.count}>{savedCases.length}</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          color={COLORS.navy}
          style={{ marginTop: 20 }}
        />
      ) : savedCases.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>⚖️</Text>

          <Text style={styles.emptyTitle}>No cases saved yet</Text>

          <Text style={styles.description}>
            Add a CNR number above to keep track of it in your account.
          </Text>
        </View>
      ) : (
        savedCases.map((item) => (
          <View key={item.id} style={styles.caseCard}>
            {item.nickname ? (
              <Text style={styles.nickname}>{item.nickname}</Text>
            ) : null}

            <Text style={styles.caseLabel}>CNR NUMBER</Text>

            <Text selectable style={styles.caseNumber}>
              {item.cnr}
            </Text>

            <Text style={styles.savedDate}>
              Saved on: {formatSavedDate(item.created_at)}
            </Text>

            <View style={styles.statusNote}>
              <Text style={styles.statusNoteText}>
                Saved locally in your account; live lookup is optional
              </Text>
            </View>

            <Pressable
              style={[styles.primaryButton, loadingLiveCaseId === item.id && { opacity: 0.6 }]}
              onPress={() => fetchLiveCase(item.cnr, item.id)}
              disabled={loadingLiveCaseId !== null}
            >
              {loadingLiveCaseId === item.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Fetch Live Details (uses API credits)</Text>
              )}
            </Pressable>

            {liveErrors[item.id] ? (
              <Text style={styles.errorText}>{liveErrors[item.id]}</Text>
            ) : null}

            {liveCases[item.id] ? (
              <View style={styles.liveDetailsBox}>
                <Text style={styles.explanationTitle}>Live case details</Text>
                <Text style={styles.liveDetailText}>Court: {displayLiveValue(liveCases[item.id].courtName || liveCases[item.id].court || liveCases[item.id].court_name)}</Text>
                <Text style={styles.liveDetailText}>Status: {displayLiveValue(liveCases[item.id].caseStatus || liveCases[item.id].status || liveCases[item.id].case_status)}</Text>
                <Text style={styles.liveDetailText}>Case number: {displayLiveValue(liveCases[item.id].caseNumber || liveCases[item.id].registrationNumber)}</Text>
                <Text style={styles.liveDetailText}>District: {displayLiveValue(liveCases[item.id].district)}</Text>
                <Text style={styles.liveDetailText}>Case type: {displayLiveValue(liveCases[item.id].caseTypeSub || liveCases[item.id].caseType)}</Text>
                <Text style={styles.liveDetailText}>Hearing records: {Array.isArray(liveCases[item.id].historyOfCaseHearings) ? liveCases[item.id].historyOfCaseHearings.length : "Not available"}</Text>
                <Text style={styles.hint}>Details depend on the data returned by the provider. Confirm important information with the official court portal.</Text>
              </View>
            ) : null}

            <View style={styles.caseActions}>
              <Pressable
                onPress={openOfficialPortal}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>
                  Check on eCourts ↗
                </Text>
              </Pressable>

              <Pressable
                onPress={() => removeCase(item.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.disclaimer}>
        Basic case saving works without the live API. Live lookups use limited eCourtsIndia credits and are only made when you tap the button. This service is a third-party API, so verify important details on the official eCourts portal.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  content: {
    padding: 18,
    paddingBottom: 36,
    gap: 16,
  },

  intro: {
    paddingVertical: 8,
    gap: 7,
  },

  eyebrow: {
    color: COLORS.grey,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  title: {
    color: COLORS.navy,
    fontSize: 25,
    fontWeight: "800",
  },

  description: {
    color: COLORS.grey,
    fontSize: 13,
    lineHeight: 19,
  },

  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "700",
  },

  label: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.navy,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },

  hint: {
    color: COLORS.grey,
    fontSize: 11.5,
    lineHeight: 17,
  },

  primaryButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginTop: 3,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.navy,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 3,
  },

  count: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#E5EAF0",
    color: COLORS.navy,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyCard: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 24,
    gap: 8,
  },

  emptyIcon: {
    fontSize: 30,
  },

  emptyTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: "700",
  },

  caseCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    gap: 9,
  },

  nickname: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "700",
  },

  caseLabel: {
    color: COLORS.grey,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  caseNumber: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  savedDate: {
    color: COLORS.grey,
    fontSize: 12,
    marginTop: -3,
  },

  statusNote: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F0E8",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  statusNoteText: {
    color: "#715A26",
    fontSize: 11,
    fontWeight: "600",
  },

  caseActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },

  smallButton: {
    paddingVertical: 8,
    paddingRight: 8,
  },

  smallButtonText: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "700",
  },

  removeButton: {
    padding: 8,
  },

  removeText: {
    color: "#A33434",
    fontSize: 12,
    fontWeight: "600",
  },

  disclaimer: {
    color: COLORS.grey,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  
orderInput: {
  minHeight: 160,
  maxHeight: 300,
  paddingTop: 12,
},

errorText: {
  color: "#A33434",
  fontSize: 12,
  lineHeight: 18,
},

explanationBox: {
  backgroundColor: "#F4F7FA",
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 10,
  padding: 14,
  gap: 8,
},

explanationTitle: {
  color: COLORS.navy,
  fontSize: 15,
  fontWeight: "700",
},

explanationText: {
  color: COLORS.navy,
  fontSize: 14,
  lineHeight: 22,
},


  liveDetailsBox: {
    backgroundColor: "#F4F7FA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    gap: 7,
  },
  liveDetailText: {
    color: COLORS.navy,
    fontSize: 12,
    lineHeight: 18,
  },

});
