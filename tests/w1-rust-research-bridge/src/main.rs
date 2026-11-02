//! RESEARCH ONLY: thin test harness calling Wand's actual w1_evidence API.
//! Never an implementation of SaveSession, P1G codec, or a Writer authority.
use ddv_save_core::sha256;
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::w1_evidence::{inspect_w1_source_research,W1Identity,W1Kind};
use std::io::{self, Read};

const KEY: [u8;32]=[0x42;32]; // public synthetic test-only value; not a game key
fn kind(s:&str)->Result<W1Kind,&'static str>{
    match s {
        "ItemSpawning"=>Ok(W1Kind::ItemSpawning),
        "WildCropsSpawningInVillage"=>Ok(W1Kind::WildCropsSpawningInVillage),
        "FlowerSpawningInVillage"=>Ok(W1Kind::FlowerSpawningInVillage),
        "FishSpawningInVillage"=>Ok(W1Kind::FishSpawningInVillage),
        _=>Err("RESEARCH_UNKNOWN_W1_VARIANT")
    }
}
fn hex(hash:[u8;32])->String {
    hash.iter().map(|x|format!("{x:02x}")).collect()
}
fn main(){
    let args:Vec<String>=std::env::args().skip(1).collect();
    let result=run(&args);
    match result {
        Ok(v)=>println!("{}",v),
        Err(s)=>println!("{}",serde_json::json!({"status":"DENIED","reason":s}))
    }
}
fn run(args:&[String])->Result<serde_json::Value,&'static str>{
    if args.len()<5||args.len()>6{return Err("TEST_ARGUMENT_COUNT");}
    let event_id=args[0].parse::<u64>().map_err(|_|"TEST_EVENT_ID")?;
    let saved_index=args[1].parse::<usize>().map_err(|_|"TEST_SAVED_INDEX")?;
    let variant=kind(&args[2])?;
    let old=&args[3];
    let new=&args[4];
    let mode=args.get(5).map(String::as_str).unwrap_or("normal");
    let mut original=Vec::new();
    io::stdin().read_to_end(&mut original).map_err(|_|"TEST_STDIN")?;
    if original.len()>1_000_000{return Err("TEST_FIXTURE_TOO_LARGE");}
    let encrypted=encode_synthetic_fixture(&original,&KEY,8)?;
    let registry=b"RESEARCH_FIXTURE_ONLY_NOT_CANONICAL_REGISTRY";
    let mut encrypted_sha=sha256(&encrypted);
    let mut registry_sha=sha256(registry);
    let build=if mode=="wrong-build"{"WRONG_BUILD"}else{"9A239D3DB569756D"};
    if mode=="wrong-encrypted-sha" {encrypted_sha=[0;32];}
    if mode=="wrong-registry-sha" {registry_sha=[0;32];}
    let witness=inspect_w1_source_research(
        &encrypted,&KEY,registry,encrypted_sha,registry_sha,build,
        W1Identity{event_id,saved_index,variant},old,new
    )?;
    Ok(serde_json::json!({
        "status":"RUST_STRUCTURAL_WITNESS_ONLY",
        "eventId":witness.identity.event_id,
        "savedIndex":witness.identity.saved_index,
        "oneof":witness.identity.variant.as_str(),
        "rowPointer":witness.row_pointer,
        "pointer":witness.next_occurrence_pointer,
        "eventIdPointer":witness.event_id_pointer,
        "oldUtc":witness.decoded_old_timestamp_utc,
        "newUtc":witness.decoded_new_timestamp_utc,
        "rawOldJson":witness.raw_old_timestamp_json,
        "rawSavedEventIdJson":witness.raw_saved_event_id_json,
        "encryptedP1gSha256":hex(witness.roots.encrypted_p1g_sha256),
        "decodedJsonSha256":hex(witness.roots.decoded_json_sha256),
        "registrySha256":hex(witness.roots.registry_sha256),
        "externalBuildId":witness.roots.build_id,
        "saveSchema":witness.roots.schema,
        "externalBuildSelectionOnly":witness.roots.external_build_selection_only,
        "buildBoundToSave":witness.roots.build_cryptographically_bound_to_save,
        "registryDigestMatched":witness.registry_digest_matched,
        "registryEventSemanticsVerified":witness.registry_event_semantics_verified,
        "nativeSemanticsVerified":witness.native_semantics_verified,
        "referenceClosureComplete":witness.required_reference_closure_complete,
        "encodeCopyAuthorized":witness.encode_copy_authorized
    }))
}
