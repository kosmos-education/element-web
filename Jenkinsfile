#!/usr/bin/env groovy
@Library('kosmos_pipeline') _

// Utilisation du pipeline générique de kosmos-pipeline
pipelineDocker(
        IMAGE_NAME: 'skolengo/element-web',
        DOCKER_LABEL: 'docker',
        NOTIF_CHANNEL: 'kde-jenkins',
        DISABLE_DEPLOYMENT_STEP: true,
        CLUSTER_NAME: 'skoen'
)

