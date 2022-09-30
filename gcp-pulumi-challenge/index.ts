import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as fs from "fs";
import * as mime from "mime";
import { Config } from "@pulumi/gcp/runtimeconfig";
import { BackendBucket } from "@pulumi/gcp/compute";


//////////////////////////////////////////////////////
// STEP 2 BEGIN
//////////////////////////////////////////////////////

// [ricc] probably we should choose only one. These bools are for me to be able
// to remove the one we dont want when everything works. For now, double public
// is ok.
//let BucketLevelPublicAccess: boolean = true;
let ObjectLevelPublicAccess: boolean = true;

// Create a GCP resource (Storage Bucket)
const bucket = new gcp.storage.Bucket("my-eu-public-bucket", {
    location: "EU",
    uniformBucketLevelAccess: false, // with next part, makes it publicly available.
});

// if (BucketLevelPublicAccess) {
//     const publicRule = new gcp.storage.BucketAccessControl("publicRule", {
//         bucket: bucket.name,
//         role: "READER",
//         entity: "allUsers",
//     });
// }
// Make sure bucket is private
// NOOP

//////////////////////////////////////////////////////
// STEP 2 END
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// STEP 3 BEGIN Working with Local Files
//////////////////////////////////////////////////////

// Create a GCP resource (Storage Bucket)
const staticWebsiteDirectory = "website";

// const gcsObjectPublicAcl = new gcp.storage.BucketACL("website-objects-public",{
// //    roleEntities = ["allUsers", ],
//     role: "READER",
//     entity: "allUsers",
// })

// ricc test: https://www.pulumi.com/registry/packages/gcp/api-docs/storage/defaultobjectacl/
// const image_store_default_acl = new gcp.storage.DefaultObjectACL("image-store-default-acl", {
//     bucket: image_store.name,
//     roleEntities: [
//         //"OWNER:user-my.email@gmail.com",
//         //"READER:group-mygroup",
//         "READER:allUsers",
//     ],
// });

// let myObjectsHash = {};
// let gcsObjectsOutputHash = {};
// let myObjectsOutputsHash = {};
// let fileCounter = 0;
// //let fruits: string[] = ['Apple', 'Orange', 'Banana'];
// let gcsObjectArray: Array<string>; // = ['Apple', 'Orange', 'Banana'];
// //gcsObjectArray[2] = 'change';

fs.readdirSync(staticWebsiteDirectory).forEach((file) => {
  const filePath = `${staticWebsiteDirectory}/${file}`;
  const fileContent = fs.readFileSync(filePath).toString();
  //fileCounter = fileCounter +1;


  // todo create many
  const gcsObject = new gcp.storage.BucketObject(file, {
    bucket: bucket.id,
    source: new pulumi.asset.FileAsset(filePath),
    contentType: mime.getType(filePath) || undefined,
    name: file, // AWESOME!! remove pseudorandom.
  });

//   if (file == 'index.html') {
//       export const indexFileRealName = gcsObject.name ;
//   }
  //gcsObjectArray.push(file);

    // ricc test: objectACL: https://www.pulumi.com/registry/packages/gcp/api-docs/storage/objectacl/
    // this is giving public access at ObjectLevel
    if (ObjectLevelPublicAccess) {
        new gcp.storage.ObjectACL(
            `acl-for-${file}`, {
                bucket: bucket.id,
                object: gcsObject.outputName,
                roleEntities: [
                    "READER:allUsers",
                ],
        });
    }

    // TODO(): export the names
//    export const myObjectsOutputsHash[file] = file;
});

//export const indexPseudorandomFilename = gcsObject[0].name

// Export the DNS name of the bucket
export const bucketName = bucket.url;
//export const bucket;

//////////////////////////////////////////////////////
// STEP 3 END
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// STEP 4 BEGIN: Creating a CDN
//////////////////////////////////////////////////////

    // [ricc] Not sure if we need Cloud CDN, I presume what
    // we really want here is a Backend Bucket? As per
    // https://www.pulumi.com/registry/packages/gcp/api-docs/compute/backendbucket/

    // copied this fix from https://github.com/pulumi/pulumi-gcp/issues/675
    const projectCompute = new gcp.projects.Service("compute-api", {
        disableDependentServices: true,
        project: new pulumi.Config('gcp').require("project"),
        service: "compute.googleapis.com",
    });

    const policy = new gcp.compute.SecurityPolicy("policy", {
        description: "basic security policy",
        type: "CLOUD_ARMOR_EDGE",
    });

    // ERROR: requires enabling GCE APIs: gcloud services enable compute.googleapis.com. I believe its a pulumi bug.
    // see above for solution
    const websiteBackend = new gcp.compute.BackendBucket(
        "website-backend", {
            description: "Contains beautiful static files",
            bucketName: bucket.name,
            enableCdn: true,
            edgeSecurityPolicy: policy.id,
    });
    //     defaultRootObject: "index.html",

    export const websiteBackendName = websiteBackend.name;

    // ricc: this only creates the BucketBE, not the FE.
    // instructions from pulumi site point to: https://cloud.google.com/load-balancing/docs/https/ext-load-balancer-backend-buckets#gcloudgsutil_3

    // TODO gsutil iam ch allUsers:objectViewer gs://BUCKET_1_NAME

    // create public IP: https://www.pulumi.com/registry/packages/gcp/api-docs/compute/address/
    //const websitePublicIp = new gcp.compute.Address("challenge-website-useless", {});

    //const websiteFwdRule = new gcp.compute.ForwardingRule("website",{});

    // TODO create UTLMAP
    const websiteUrlMap = new gcp.compute.URLMap("website-um", {
        defaultService: websiteBackend.selfLink,
        // inspired by: https://github.com/pulumi/pulumi-gcp/blob/master/examples/loadbalancer/index.ts
        // pathRules: [
        //     {
        //         paths: [
        //             "/video",
        //             "/video/*",
        //         ],
        //     }
        // ],
    });
    //# gcloud compute url-maps create http-lb \
    //#--default-backend-bucket=cats
    const defaultTargetHttpProxy = new gcp.compute.TargetHttpProxy("website", {
        description: "a description",
        urlMap: websiteUrlMap.id,
    });
    const defaultGlobalForwardingRule = new gcp.compute.GlobalForwardingRule("fwdrl-website", {
        target: defaultTargetHttpProxy.id,
        portRange: "80",
        // can attach ip here.
        //ipAddress: websitePublicIp.selfLink,
        loadBalancingScheme: "EXTERNAL_MANAGED",
    });


    export const fwdrulePublicIp = defaultGlobalForwardingRule.ipAddress;



//////////////////////////////////////////////////////
// STEP 4 END
//////////////////////////////////////////////////////


//////////////////////////////////////////////////////
// STEP 5 BEGIN
//////////////////////////////////////////////////////

// [ricc] please help. Im not able to refactor TS code :)

//////////////////////////////////////////////////////
// STEP 5 END
//////////////////////////////////////////////////////



//////////////////////////////////////////////////////
// STEP 6 BEGIN
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// STEP 6 END
//////////////////////////////////////////////////////



//////////////////////////////////////////////////////
// STEP 7 BEGIN
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
// STEP 7 END
//////////////////////////////////////////////////////



// Addons
// These are not part of the orgiinal but seems googly to add them

export const readme = fs.readFileSync("./Pulumi.README.md").toString();
export const projectId = new pulumi.Config('gcp').require("project");
export const bucketDepuredName = bucket.name // without gs://

//export const websitePublicIpAddress = websitePublicIp.address;
