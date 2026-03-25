{{/*
Expand the name of the chart.
*/}}
{{- define "lakehouse.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "lakehouse.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lakehouse.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "lakehouse.labels" -}}
helm.sh/chart: {{ include "lakehouse.chart" . }}
{{ include "lakehouse.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: lakehouse-platform
{{- end }}

{{/*
Selector labels
*/}}
{{- define "lakehouse.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lakehouse.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API component labels
*/}}
{{- define "lakehouse.api.labels" -}}
{{ include "lakehouse.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{- define "lakehouse.api.selectorLabels" -}}
{{ include "lakehouse.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Frontend component labels
*/}}
{{- define "lakehouse.frontend.labels" -}}
{{ include "lakehouse.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "lakehouse.frontend.selectorLabels" -}}
{{ include "lakehouse.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}
