use std::path::Path;

fn main() {
    // Merge protocols from project root into src-tauri/protocols for bundling.
    // src-tauri/protocols/ is the primary collection; ../protocols/ may have extras.
    // We merge (don't replace) so protocols in either location get bundled.
    let root_protocols = Path::new("../protocols");
    let dst = Path::new("protocols");

    // Ensure dst exists
    let _ = std::fs::create_dir_all(dst);

    // Copy any protocols from root that don't already exist in src-tauri/protocols
    if root_protocols.is_dir() {
        merge_protocols(root_protocols, dst);
    }

    println!("cargo:warning=Bundled {} protocol directories", count_subdirs(dst));

    // Re-run build script if protocols change
    println!("cargo:rerun-if-changed=../protocols");
    println!("cargo:rerun-if-changed=protocols");

    tauri_build::build()
}

/// Merge protocols from src into dst without overwriting existing ones.
fn merge_protocols(src: &Path, dst: &Path) {
    if let Ok(entries) = std::fs::read_dir(src) {
        for entry in entries.flatten() {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            let name_str = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files/dirs
            if name_str.starts_with('.') {
                continue;
            }

            // Only copy if it doesn't exist in dst
            if !dst_path.exists() {
                if src_path.is_dir() {
                    let _ = copy_dir_recursive(&src_path, &dst_path);
                } else {
                    let _ = std::fs::copy(&src_path, &dst_path);
                }
            }
        }
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            // Skip hidden directories like .DS_Store folders
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with('.') {
                continue;
            }
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            // Skip hidden files
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with('.') {
                continue;
            }
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn count_subdirs(dir: &Path) -> usize {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .count()
        })
        .unwrap_or(0)
}
