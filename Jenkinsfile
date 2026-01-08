#!/usr/bin/env groovy
@Library('kosmos_pipeline') _

// Utilisation du pipeline générique de kosmos-pipeline
pipelineDocker(
        IMAGE_NAME: 'skolengo/element-web',
        DOCKER_LABEL: 'docker',
        NOTIF_CHANNEL: 'kde-jenkins',
        DISABLE_DEPLOYMENT_STEP: true,
        CLUSTER_NAME: 'skoen',

        PRE_BUILD_CLOSURE: {
            sh '''
                if git rev-parse --is-shallow-repository > /dev/null 2>&1; then
                git fetch --unshallow
                fi
                git fetch --tags
            '''
        }
)

