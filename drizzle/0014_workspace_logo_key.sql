-- The column holds the key of the logo in storage, never a URL: the address is built when it is read.
ALTER TABLE "workspaces" RENAME COLUMN "logo_url" TO "logo_key";
